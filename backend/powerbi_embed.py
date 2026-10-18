"""Power BI embed status. Tokens stay on the server and are never invented."""

import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

from fastapi import HTTPException

REQUIRED = (
    "POWERBI_TENANT_ID",
    "POWERBI_CLIENT_ID",
    "POWERBI_CLIENT_SECRET",
    "POWERBI_WORKSPACE_ID",
)
REPORTS = {
    "productivity": "POWERBI_REPORT_PRODUCTIVITY",
    "forecast-monitoring": "POWERBI_REPORT_FORECAST_MONITORING",
    "kpi-simulator": "POWERBI_REPORT_KPI_SIMULATOR",
    "kpi-forecasts": "POWERBI_REPORT_KPI_FORECASTS",
    "postal-kpi-dashboard": "POWERBI_REPORT_POSTAL_KPI_DASHBOARD",
}


def _value(name: str) -> str:
    return os.environ.get(name, "").strip()


def status() -> dict:
    missing = [name for name in REQUIRED if not _value(name)]
    reports = {page: bool(_value(env_name)) for page, env_name in REPORTS.items()}
    configured = not missing
    return {
        "configured": configured,
        "embedding": "app-owns-data",
        "publish_to_web": False,
        "missing": missing,
        "reports_configured": reports,
        "row_level_security": False,
        "refresh": (
            "Opening a page does not refresh the Power BI dataset. "
            "Schedule refresh in the Power BI service."
        ),
        "note": (
            "Embed tokens are issued only after the workspace, service principal, "
            "and report ids are configured. Publish to web is not used."
        ),
    }


def _token(tenant: str, client_id: str, client_secret: str) -> str:
    body = urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://analysis.windows.net/powerbi/api/.default",
        }
    ).encode()
    request = Request(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data=body,
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Power BI authentication did not succeed. Check the service principal and tenant.",
        ) from exc
    token = payload.get("access_token")
    if not token:
        raise HTTPException(status_code=503, detail="Power BI did not return an access token.")
    return token


def _embed_token(access_token: str, workspace_id: str, report_id: str) -> dict:
    request = Request(
        f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/GenerateToken",
        data=json.dumps({"accessLevel": "View"}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Power BI did not issue an embed token for this report.",
        ) from exc
    if not payload.get("token"):
        raise HTTPException(status_code=503, detail="Power BI did not issue an embed token for this report.")
    return payload


def _report(access_token: str, workspace_id: str, report_id: str) -> dict:
    request = Request(
        f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Power BI did not return this report.") from exc


def embed_for(page: str) -> dict:
    if page not in REPORTS:
        raise HTTPException(status_code=404, detail="That page has no Power BI report slot.")
    current = status()
    if current["missing"]:
        raise HTTPException(status_code=503, detail=current)
    if not current["reports_configured"].get(page):
        raise HTTPException(status_code=503, detail=f"{REPORTS[page]} is not set.")
    report_id = _value(REPORTS[page])
    access = _token(_value("POWERBI_TENANT_ID"), _value("POWERBI_CLIENT_ID"), _value("POWERBI_CLIENT_SECRET"))
    report = _report(access, _value("POWERBI_WORKSPACE_ID"), report_id)
    embed = _embed_token(access, _value("POWERBI_WORKSPACE_ID"), report_id)
    embed_url = report.get("embedUrl")
    if not embed_url:
        raise HTTPException(status_code=503, detail="Power BI did not return an embed URL.")
    return {
        "page": page,
        "reportId": report_id,
        "embedUrl": embed_url,
        "accessToken": embed["token"],
        "expiration": embed.get("expiration"),
    }
