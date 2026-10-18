"""The Postal KPI desk (backend/routes.py) is served by the same app; it must never shadow a registered-mail path."""
from __future__ import annotations

from fastapi.routing import APIRoute

from conftest import requires_mongo


def test_desk_routes_come_after_every_registered_mail_route():
    from app.main import app

    routes = [r for r in app.routes if isinstance(r, APIRoute)]
    desk = [i for i, r in enumerate(routes) if "kpi desk" in (r.tags or [])]
    ours = [i for i, r in enumerate(routes) if "kpi desk" not in (r.tags or [])]
    if desk:   # the desk is optional: it is skipped when its packages are missing
        assert min(desk) > max(ours)


@requires_mongo
def test_both_health_checks_answer(client):
    assert client.get("/api/health").json()["component"] == "smart-registered-mail"
    desk = client.get("/health")
    assert desk.status_code in (200, 404)   # 404 when the desk is not installed
