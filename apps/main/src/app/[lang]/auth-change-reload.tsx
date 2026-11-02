"use client";

import { reloadOnAuthChange } from "@/lib/auth/auth-change";
import { useEffect } from "react";

export function AuthChangeReload() {
  useEffect(() => reloadOnAuthChange(), []);

  return null;
}
