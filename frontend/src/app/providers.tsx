// src/app/providers.tsx
"use client";

import { GoogleAuthProvider } from "@/context/GoogleAuthContext";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <GoogleAuthProvider>{children}</GoogleAuthProvider>;
}
