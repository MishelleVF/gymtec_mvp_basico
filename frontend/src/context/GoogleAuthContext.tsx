// src/context/GoogleAuthContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { GoogleUserInfo } from "@/types/gymtec";
import {
  getStoredGoogleToken,
  getStoredGoogleUser,
  storeGoogleToken,
  storeGoogleUser,
  clearGoogleToken as clearStorage,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from "@/services/googleCalendarApi";

interface GoogleAuthState {
  /** Whether Google Calendar is connected (token exists). */
  connected: boolean;
  /** Google user info (name, email, picture). Null until fetched. */
  user: GoogleUserInfo | null;
  /** The stored access token, if any. */
  token: string | null;
  /** True while exchanging an OAuth code or loading user info. */
  loading: boolean;
  /** Connect with an OAuth authorization code (from redirect). */
  connectWithCode: (code: string) => Promise<void>;
  /** Connect using an already-stored token (restoring session). */
  restoreSession: () => Promise<void>;
  /** Disconnect: clear token, user info. */
  disconnect: () => void;
}

const GoogleAuthContext = createContext<GoogleAuthState>({
  connected: false,
  user: null,
  token: null,
  loading: false,
  connectWithCode: async () => {},
  restoreSession: async () => {},
  disconnect: () => {},
});

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<GoogleUserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // On mount: restore from localStorage
  useEffect(() => {
    const storedToken = getStoredGoogleToken();
    const storedUser = getStoredGoogleUser();
    if (storedToken) {
      setToken(storedToken);
      setConnected(true);
      if (storedUser) {
        setUser(storedUser);
      }
    }
  }, []);

  const connectWithCode = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await exchangeGoogleCode(code);
      storeGoogleToken(res.access_token);
      setToken(res.access_token);
      setConnected(true);

      // Fetch user info
      try {
        const info = await fetchGoogleUserInfo(res.access_token);
        storeGoogleUser(info);
        setUser(info);
      } catch {
        // Non-critical: connection still works without user info
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    const storedToken = getStoredGoogleToken();
    if (!storedToken) return;
    setToken(storedToken);
    setConnected(true);

    const storedUser = getStoredGoogleUser();
    if (storedUser) {
      setUser(storedUser);
      return;
    }

    // Try to fetch user info with stored token
    setLoading(true);
    try {
      const info = await fetchGoogleUserInfo(storedToken);
      storeGoogleUser(info);
      setUser(info);
    } catch {
      // Token may be expired — still mark as "connected" so UI can offer resync
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearStorage();
    setToken(null);
    setUser(null);
    setConnected(false);
  }, []);

  return (
    <GoogleAuthContext.Provider
      value={{
        connected,
        user,
        token,
        loading,
        connectWithCode,
        restoreSession,
        disconnect,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}
