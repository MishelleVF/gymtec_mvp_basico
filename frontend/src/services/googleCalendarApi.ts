// src/services/googleCalendarApi.ts
// Google Calendar integration service.
// All Google OAuth + Calendar API calls go through the backend to keep secrets safe.

import { apiGet, apiPost, apiGetGoogle, apiPostGoogle } from "./api";
import {
  BusySlot,
  CalendarEvent,
  DayCode,
  GoogleAuthUrlResponse,
  GoogleCallbackRequest,
  GoogleEventsRequest,
  GoogleEventsResponse,
  GoogleTokenResponse,
  GoogleUserInfo,
} from "@/types/gymtec";
import { fmtHour } from "@/lib/utils";

// ---------------------------------------------------------------------------
// API calls (all routed through backend)
// ---------------------------------------------------------------------------

/** Get the Google OAuth consent URL from the backend. */
export async function getGoogleAuthUrl(): Promise<string> {
  const res = await apiGetGoogle<GoogleAuthUrlResponse>("/api/v1/google/auth-url");
  return res.url;
}

// Deduplication: OAuth codes are single-use. If exchangeGoogleCode is called
// twice with the same code (React StrictMode double-effect), reuse the same
// in-flight promise so only ONE HTTP request reaches the backend.
let _pendingExchange: Promise<GoogleTokenResponse> | null = null;
let _pendingCode: string | null = null;

/** Exchange an OAuth authorization code for an access token. */
export async function exchangeGoogleCode(
  code: string
): Promise<GoogleTokenResponse> {
  if (_pendingCode === code && _pendingExchange) {
    return _pendingExchange;
  }

  _pendingCode = code;
  _pendingExchange = apiPostGoogle<GoogleCallbackRequest, GoogleTokenResponse>(
    "/api/v1/google/callback",
    { code }
  );

  try {
    const result = await _pendingExchange;
    return result;
  } catch (err) {
    // Allow retry with a fresh code
    _pendingCode = null;
    _pendingExchange = null;
    throw err;
  }
}

/** Fetch calendar events for the current week. */
export async function fetchCalendarEvents(
  accessToken: string,
  weekStart?: string
): Promise<GoogleEventsResponse> {
  return apiPostGoogle<GoogleEventsRequest, GoogleEventsResponse>(
    "/api/v1/google/events",
    { access_token: accessToken, week_start: weekStart }
  );
}

/** Fetch the authenticated user's name, email and picture. */
export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  return apiPostGoogle<{ access_token: string }, GoogleUserInfo>(
    "/api/v1/google/userinfo",
    { access_token: accessToken }
  );
}

// ---------------------------------------------------------------------------
// Conversion: CalendarEvent[] → BusySlot[]
// ---------------------------------------------------------------------------

const VALID_DAYS = new Set<string>(["L", "M", "X", "J", "V", "S"]);

/**
 * Convert selected calendar events into BusySlot[] in the format the model
 * expects. Each event is split into 1-hour blocks aligned to the schedule grid
 * (07:00–22:00). Sunday events ("D") are ignored.
 */
export function calendarEventsToBusySlots(
  events: CalendarEvent[]
): BusySlot[] {
  const slotSet = new Set<string>(); // "L|07:00" dedup key

  for (const ev of events) {
    if (!ev.selected) continue;
    if (!VALID_DAYS.has(ev.day_code)) continue;

    const day = ev.day_code as DayCode;

    if (ev.all_day) {
      // All-day event → block every hour 07–22
      for (let h = 7; h < 22; h++) {
        slotSet.add(`${day}|${fmtHour(h)}`);
      }
    } else {
      const startHour = parseInt(ev.start_time.split(":")[0], 10);
      const endHour = parseInt(ev.end_time.split(":")[0], 10);
      const endMin = parseInt(ev.end_time.split(":")[1], 10);
      const effectiveEnd = endMin > 0 ? endHour + 1 : endHour;

      for (let h = Math.max(startHour, 7); h < Math.min(effectiveEnd, 22); h++) {
        slotSet.add(`${day}|${fmtHour(h)}`);
      }
    }
  }

  return Array.from(slotSet).map((key) => {
    const [day, startTime] = key.split("|");
    const h = parseInt(startTime.split(":")[0], 10);
    return {
      day: day as DayCode,
      start_time: fmtHour(h),
      end_time: fmtHour(h + 1),
    };
  });
}

// ---------------------------------------------------------------------------
// Persistent storage helpers (localStorage for session persistence)
// ---------------------------------------------------------------------------

const TOKEN_KEY = "gymtec.gcal_token";
const USER_KEY = "gymtec.gcal_user";

export function storeGoogleToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getStoredGoogleToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function storeGoogleUser(user: GoogleUserInfo): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getStoredGoogleUser(): GoogleUserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as GoogleUserInfo) : null;
  } catch {
    return null;
  }
}

export function clearGoogleToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
