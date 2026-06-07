"""
Google Calendar integration – OAuth 2.0 + Events fetch.

Endpoints:
  GET  /api/v1/google/auth-url          → returns the OAuth consent URL
  POST /api/v1/google/callback          → exchanges code for tokens, returns events
  POST /api/v1/google/events            → fetches events with an existing access_token

Environment variables (set in .env):
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_REDIRECT_URI   (default: http://localhost:3000/schedule)
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/google", tags=["google-calendar"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"


def _client_id() -> str:
    v = os.getenv("GOOGLE_CLIENT_ID", "")
    if not v:
        raise HTTPException(503, "GOOGLE_CLIENT_ID not configured")
    return v


def _client_secret() -> str:
    v = os.getenv("GOOGLE_CLIENT_SECRET", "")
    if not v:
        raise HTTPException(503, "GOOGLE_CLIENT_SECRET not configured")
    return v


def _redirect_uri() -> str:
    return os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/schedule")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class AuthUrlResponse(BaseModel):
    url: str


class CallbackRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    access_token: str
    expires_in: int


class CalendarEvent(BaseModel):
    id: str
    summary: str
    start: str          # ISO datetime
    end: str            # ISO datetime
    day_code: str       # L, M, X, J, V, S
    start_time: str     # HH:mm
    end_time: str       # HH:mm
    all_day: bool


class EventsRequest(BaseModel):
    access_token: str
    week_start: str | None = None   # ISO date, defaults to current Monday


class EventsResponse(BaseModel):
    events: list[CalendarEvent]
    week_label: str


class UserInfoRequest(BaseModel):
    access_token: str


class UserInfoResponse(BaseModel):
    name: str
    email: str
    picture: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
_ISO_DAY_TO_CODE = {
    0: "L",  # Monday
    1: "M",
    2: "X",
    3: "J",
    4: "V",
    5: "S",
    6: "D",  # Sunday – gym closed, we still return it
}


def _current_monday() -> datetime:
    now = datetime.now()
    return (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def _parse_events(items: list[dict[str, Any]]) -> list[CalendarEvent]:
    """Convert raw Google Calendar items into our CalendarEvent model."""
    out: list[CalendarEvent] = []
    for item in items:
        if item.get("status") == "cancelled":
            continue
        start_raw = item.get("start", {})
        end_raw = item.get("end", {})

        all_day = "date" in start_raw and "dateTime" not in start_raw

        if all_day:
            start_dt = datetime.fromisoformat(start_raw["date"])
            end_dt = datetime.fromisoformat(end_raw["date"])
        else:
            start_str = start_raw.get("dateTime", "")
            end_str = end_raw.get("dateTime", "")
            if not start_str or not end_str:
                continue
            start_dt = datetime.fromisoformat(start_str)
            end_dt = datetime.fromisoformat(end_str)

        day_code = _ISO_DAY_TO_CODE.get(start_dt.weekday(), "D")

        out.append(
            CalendarEvent(
                id=item.get("id", ""),
                summary=item.get("summary", "(Sin título)"),
                start=start_dt.isoformat(),
                end=end_dt.isoformat(),
                day_code=day_code,
                start_time=start_dt.strftime("%H:%M") if not all_day else "00:00",
                end_time=end_dt.strftime("%H:%M") if not all_day else "23:59",
                all_day=all_day,
            )
        )
    return out


async def _fetch_events(access_token: str, time_min: str, time_max: str) -> list[dict]:
    """Call Google Calendar API – list events for primary calendar."""
    url = f"{GOOGLE_CALENDAR_API}/calendars/primary/events"
    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "250",
    }
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params, headers=headers)

    if resp.status_code == 401:
        raise HTTPException(401, "Google token expired or invalid")
    if resp.status_code != 200:
        logger.error("Google API error %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(502, "Error fetching Google Calendar events")

    data = resp.json()
    return data.get("items", [])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/auth-url", response_model=AuthUrlResponse)
async def get_auth_url():
    """Return the Google OAuth consent URL for the frontend to redirect to."""
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "online",
        "prompt": "consent",
    }
    qs = "&".join(f"{k}={httpx.URL('', params={k: v}).params[k]}" for k, v in params.items())
    # Build URL properly
    from urllib.parse import urlencode
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return AuthUrlResponse(url=url)


@router.post("/callback", response_model=TokenResponse)
async def exchange_code(body: CallbackRequest):
    """Exchange the OAuth authorization code for an access token."""
    payload = {
        "code": body.code,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri": _redirect_uri(),
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=payload)

    if resp.status_code != 200:
        logger.error("Token exchange failed %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(400, "Failed to exchange authorization code")

    data = resp.json()
    return TokenResponse(
        access_token=data["access_token"],
        expires_in=data.get("expires_in", 3600),
    )


@router.post("/events", response_model=EventsResponse)
async def get_events(body: EventsRequest):
    """Fetch events for the current (or specified) week."""
    if body.week_start:
        monday = datetime.fromisoformat(body.week_start)
    else:
        monday = _current_monday()

    saturday_end = monday + timedelta(days=5, hours=23, minutes=59)
    time_min = monday.isoformat() + "Z"
    time_max = saturday_end.isoformat() + "Z"

    items = await _fetch_events(body.access_token, time_min, time_max)
    events = _parse_events(items)

    week_label = f"{monday.strftime('%d/%m')} – {saturday_end.strftime('%d/%m/%Y')}"
    return EventsResponse(events=events, week_label=week_label)


@router.post("/userinfo", response_model=UserInfoResponse)
async def get_user_info(body: UserInfoRequest):
    """Fetch the authenticated user's name, email and picture."""
    url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization": f"Bearer {body.access_token}"}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code == 401:
        raise HTTPException(401, "Google token expired or invalid")
    if resp.status_code != 200:
        logger.error("Userinfo error %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(502, "Error fetching Google user info")

    data = resp.json()
    return UserInfoResponse(
        name=data.get("name", ""),
        email=data.get("email", ""),
        picture=data.get("picture"),
    )
