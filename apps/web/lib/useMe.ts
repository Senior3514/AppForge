"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Me } from "./types";

/** Current session + plan + server mode. `reload` after login/logout/upgrade. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const reload = useCallback(async () => {
    try { setMe(await api<Me>("/me")); } catch { setMe({ user: null, server: { llm: "unknown" } }); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { me, reload };
}
