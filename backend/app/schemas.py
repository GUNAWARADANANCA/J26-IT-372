"""Request bodies accepted by the API (validated by Pydantic)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Language = Literal["en", "si", "ta"]


class LoginIn(BaseModel):
    username: str
    password: str


# --------------------------------------------------------------------------- intake
class PartyIn(BaseModel):
    name: str = ""
    house_number: str = ""
    street: str = ""
    locality: str = ""
    city: str = ""
    region: str = ""
    postcode: str = ""
    country: str = ""
    raw_text: str = ""


class NotificationIn(BaseModel):
    channel: Literal["email", "sms", "none"] = "none"
    contact: str = ""
    language: Language = "en"
    updates: Literal["key", "all", "none"] = "key"

    @field_validator("contact")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class ServiceIn(BaseModel):
    advice_of_delivery: bool = False
    insured_value_lkr: float | None = None


class DraftUpdate(BaseModel):
    sender: PartyIn | None = None
    recipient: PartyIn | None = None
    notification: NotificationIn | None = None
    service: ServiceIn | None = None
    experiment_config: Literal["B0", "B1", "P1"] | None = None
    destination_office_id: str | None = None


class ConfirmFieldsIn(BaseModel):
    confirmed_fields: list[str]


class CropIn(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class OcrIn(BaseModel):
    mode: Literal["B1", "P1"] = "P1"
    target: Literal["recipient", "sender"] = "recipient"
    crop: CropIn | None = None
    rotate: Literal[0, 90, 180, 270] = 0
    script_hint: Literal["auto", "si", "ta", "en"] = "auto"
    writing: Literal["auto", "handwritten", "printed"] = "auto"


class ParseIn(BaseModel):
    text: str = Field(max_length=2000)


class NormalizeIn(BaseModel):
    text: str = Field(max_length=2000)
    use_llm: bool = False


class CaptureIn(BaseModel):
    device_id: str
    flash: bool = False


class PairWeightIn(BaseModel):
    device_id: str


class ManualWeightIn(BaseModel):
    grams: float = Field(gt=0, le=5000)
    reason: str = Field(min_length=5, max_length=300)
    instrument: str = Field(min_length=2, max_length=120)


class QuoteIn(BaseModel):
    advice_of_delivery: bool = False
    insured_value_lkr: float | None = None


class PaymentIn(BaseModel):
    method: Literal["cash", "card", "other"]
    amount_lkr: str
    reference: str = ""


class AcceptIn(BaseModel):
    quote_id: str
    payment: PaymentIn


class LabelVerifyIn(BaseModel):
    scanned_value: str


class ReasonIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


# --------------------------------------------------------------------------- field events
class LocationIn(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)
    fix_age_s: float | None = Field(default=None, ge=0)
    altitude_m: float | None = None
    permission: Literal["granted", "denied", "unavailable", "timeout"] | None = None
    mock: bool | None = None
    provider: str | None = None


class AcknowledgementIn(BaseModel):
    type: Literal["signature", "recipient_name", "otp", "paper_sheet", "none"] = "none"
    recipient_name: str = ""
    relationship: str = ""
    signature_svg: str = Field(default="", max_length=60_000)
    reference: str = ""


class ScanIn(BaseModel):
    event_id: str = Field(min_length=8, max_length=64)
    item_id: str
    requested_status: str
    captured_at: datetime
    expected_revision: int | None = None
    device_id: str = ""
    client_version: str = ""
    offline: bool = False
    location: LocationIn | None = None
    acknowledgement: AcknowledgementIn | None = None
    reason: str = ""
    exception_reason: str = ""
    notes: str = Field(default="", max_length=500)


class ScanBatchIn(BaseModel):
    events: list[ScanIn] = Field(max_length=200)


class ReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    reason: str = Field(min_length=3, max_length=300)


class AssignIn(BaseModel):
    postman_username: str


class RecipientPinIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: float = Field(default=50, gt=0, le=1000)
    provenance: str = Field(min_length=5, max_length=200)


# --------------------------------------------------------------------------- IoT
class ReadingIn(BaseModel):
    seq: int
    boot_id: str
    uptime_ms: int
    captured_at: datetime | None = None
    net_g: float | None = None
    raw: int | None = None
    spread_g: float | None = None
    stable: bool = False
    loaded: bool = False
    placement_id: int = 0
    calibration_id: str = ""
    sensor_ok: bool = True
    needs_tare: bool = False  # device lost its zero (e.g. after a restart) and refuses to weigh
    sample_count: int = 0
    rssi: int | None = None
    fw: str = ""
    ip: str = ""
    camera_ok: bool | None = None


class CommandResultIn(BaseModel):
    status: Literal["done", "failed"]
    result: dict = {}


class DeviceCommandIn(BaseModel):
    type: Literal["tare", "calibrate", "capture", "set_config", "reboot", "identify"]
    params: dict = {}


class DeviceCreateIn(BaseModel):
    device_id: str = Field(pattern=r"^[A-Z0-9][A-Z0-9-]{2,31}$")
    office_id: str
    description: str = ""


class TrialIn(BaseModel):
    reference_g: float = Field(gt=0, le=5000)
    condition: str = Field(default="centre", max_length=60)
    note: str = Field(default="", max_length=200)


class CalibrationUncertaintyIn(BaseModel):
    expanded_uncertainty_g: float = Field(gt=0, le=50)
    evidence: str = Field(min_length=5, max_length=300)


# --------------------------------------------------------------------------- admin
class OfficeUpdate(BaseModel):
    name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    zone_radius_m: float | None = Field(default=None, gt=0, le=5000)
    service_radius_m: float | None = Field(default=None, gt=0, le=50_000)
    provenance: str = Field(min_length=5, max_length=200)


class UserCreateIn(BaseModel):
    username: str = Field(pattern=r"^[a-z0-9_.-]{3,32}$")
    full_name: str
    role: Literal["admin", "postmaster", "counter_officer", "hub_officer", "postman"]
    office_id: str
    password: str = Field(min_length=8)
    beat_postcodes: list[str] = []


class PolicyModeIn(BaseModel):
    mode: Literal["L0", "L1", "L2"]
    reason: str = Field(min_length=3)
