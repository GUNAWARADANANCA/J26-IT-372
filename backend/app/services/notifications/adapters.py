"""Delivery adapters for sender notifications.

Every adapter returns a ``SendResult`` with one of four outcomes so the outbox
can treat failures honestly (proposal section 3.11, test T15):

    accepted   the provider accepted the message (NOT proof it was read)
    retryable  temporary failure; safe to try again
    permanent  will not succeed (e.g. invalid address); shown on the dashboard
    ambiguous  we cannot tell whether the provider accepted it (e.g. timeout
               after the request was sent). Retried only if the provider
               de-duplicates by idempotency key; otherwise left for an officer.

Adapters:
    file    writes .eml files to storage/outbox_mail/ (default, no account needed)
    smtp    any SMTP server (e.g. a Mailtrap sandbox or an institutional relay)
    resend  Resend HTTP API with an Idempotency-Key header
    sms     stub that only logs; a real SMS gateway is optional and not assumed free
"""
from __future__ import annotations

import json
import smtplib
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path

from ...config import Settings


@dataclass
class SendResult:
    outcome: str
    provider_message_id: str | None = None
    detail: str = ""


class FileEmailAdapter:
    name = "file"
    supports_idempotency = True

    def __init__(self, s: Settings):
        self.dir = s.storage_dir / "outbox_mail"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.sender = s.smtp_from

    def send(self, *, to: str, subject: str, body: str, key: str) -> SendResult:
        path = self.dir / f"{key}.eml"
        if path.exists():  # idempotent: same key -> same message
            return SendResult("accepted", path.name, "already written")
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, to, subject
        msg["Message-ID"] = make_msgid(domain="postassist.local")
        msg.set_content(body)
        path.write_bytes(bytes(msg))
        return SendResult("accepted", path.name, f"written to {path}")


class SmtpEmailAdapter:
    name = "smtp"
    supports_idempotency = False

    def __init__(self, s: Settings):
        self.s = s

    def send(self, *, to: str, subject: str, body: str, key: str) -> SendResult:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.s.smtp_from, to, subject
        msg["Message-ID"] = make_msgid(idstring=key[:16], domain="postassist.local")
        msg.set_content(body)
        sent_data = False
        try:
            with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=20) as smtp:
                smtp.starttls()
                if self.s.smtp_user:
                    smtp.login(self.s.smtp_user, self.s.smtp_password)
                sent_data = True
                smtp.send_message(msg)
            return SendResult("accepted", msg["Message-ID"])
        except smtplib.SMTPRecipientsRefused as exc:
            return SendResult("permanent", detail=f"recipient refused: {exc}")
        except smtplib.SMTPAuthenticationError as exc:
            return SendResult("permanent", detail=f"SMTP authentication failed: {exc}")
        except (socket.timeout, TimeoutError) as exc:
            return SendResult("ambiguous" if sent_data else "retryable", detail=f"timeout: {exc}")
        except (smtplib.SMTPException, OSError) as exc:
            return SendResult("ambiguous" if sent_data else "retryable", detail=str(exc))


class ResendEmailAdapter:
    name = "resend"
    supports_idempotency = True
    URL = "https://api.resend.com/emails"

    def __init__(self, s: Settings):
        self.s = s

    def send(self, *, to: str, subject: str, body: str, key: str) -> SendResult:
        data = json.dumps({"from": self.s.resend_from, "to": [to], "subject": subject, "text": body}).encode()
        req = urllib.request.Request(self.URL, data=data, method="POST", headers={
            "Authorization": f"Bearer {self.s.resend_api_key}", "Content-Type": "application/json",
            "Idempotency-Key": key})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = json.loads(resp.read() or b"{}")
                return SendResult("accepted", payload.get("id"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:300]
            if exc.code == 429 or exc.code >= 500:
                return SendResult("retryable", detail=f"HTTP {exc.code}: {detail}")
            return SendResult("permanent", detail=f"HTTP {exc.code}: {detail}")
        except (socket.timeout, TimeoutError) as exc:
            return SendResult("ambiguous", detail=f"timeout after sending: {exc}")
        except urllib.error.URLError as exc:
            return SendResult("retryable", detail=str(exc.reason))


class SmsStubAdapter:
    name = "sms"
    supports_idempotency = True

    def __init__(self, s: Settings):
        self.path = s.storage_dir / "outbox_sms.log"

    def send(self, *, to: str, subject: str, body: str, key: str) -> SendResult:
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"key": key, "to": to, "body": body}, ensure_ascii=False) + "\n")
        return SendResult("accepted", key, "logged by SMS stub (no gateway configured)")


class FaultInjectingAdapter:
    """Wraps an adapter to reproduce failure scenarios in experiments.

    OUTBOX_FAULT_MODE: fail_first | permanent | timeout_once | always_timeout
    """

    def __init__(self, inner, mode: str):
        self.inner, self.mode = inner, mode
        self.name = f"{inner.name}+{mode}"
        self.supports_idempotency = inner.supports_idempotency
        self._seen: set[str] = set()

    def send(self, *, to: str, subject: str, body: str, key: str) -> SendResult:
        first = key not in self._seen
        self._seen.add(key)
        if self.mode == "fail_first" and first:
            return SendResult("retryable", detail="injected: provider temporarily unavailable")
        if self.mode == "permanent":
            return SendResult("permanent", detail="injected: provider rejected the message")
        if self.mode == "timeout_once" and first:
            self.inner.send(to=to, subject=subject, body=body, key=key)  # the provider *did* get it
            return SendResult("ambiguous", detail="injected: timeout after the provider accepted")
        if self.mode == "always_timeout":
            return SendResult("ambiguous", detail="injected: timeout")
        return self.inner.send(to=to, subject=subject, body=body, key=key)


def build_adapters(s: Settings) -> dict:
    email = {"file": FileEmailAdapter, "smtp": SmtpEmailAdapter, "resend": ResendEmailAdapter}.get(
        s.email_adapter, FileEmailAdapter)(s)
    adapters = {"email": email, "sms": SmsStubAdapter(s)}
    if s.outbox_fault_mode not in ("", "none"):
        adapters = {k: FaultInjectingAdapter(v, s.outbox_fault_mode) for k, v in adapters.items()}
    return adapters


def mail_preview_dir(s: Settings) -> Path:
    return s.storage_dir / "outbox_mail"
