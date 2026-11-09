import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createDemoClient, createLiveClient, type DataClient } from "./client";
import type { Business } from "./types";

/** One client for the whole app; resolved once at boot. */
let clientPromise: Promise<DataClient> | null = null;

export function resolveClient(): Promise<DataClient> {
  if (!clientPromise) {
    const liveId = import.meta.env.VITE_REGISTRY_CONTRACT as string | undefined;
    clientPromise = (liveId
      ? createLiveClient(liveId).then((c) => c ?? createDemoClient())
      : Promise.resolve(createDemoClient()));
  }
  return clientPromise;
}

export function useClient(): DataClient | null {
  const [client, setClient] = useState<DataClient | null>(null);
  useEffect(() => {
    let alive = true;
    resolveClient().then((c) => alive && setClient(c));
    return () => {
      alive = false;
    };
  }, []);
  return client;
}

/** Subscribe to the demo client's mutable store. */
export function useBusinesses(client: DataClient | null): Business[] {
  const subscribe = useCallback(
    (cb: () => void) => (client ? client.subscribe(cb) : () => {}),
    [client],
  );
  const snapshot = useCallback(() => (client ? client.list() : EMPTY), [client]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const EMPTY: Business[] = [];

export function useBusiness(client: DataClient | null, tokenId?: string) {
  const all = useBusinesses(client);
  return useMemo(() => all.find((b) => b.tokenId === tokenId), [all, tokenId]);
}

/** Re-render on a timer so "1m ago" and countdowns stay honest. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "bad" | "plain";
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, tone: Toast["tone"] = "plain") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return { toasts, push };
}

/** Tiny history router: pushState + popstate. No dependency, no surprises. */
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname) return;
    window.history.pushState({}, "", to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return { path, navigate };
}
