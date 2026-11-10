import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createDemoClient, createLiveClient, type DataClient } from "./client";
import type { Business } from "./types";

/** One client for the whole app; resolved once at boot. */
let clientPromise: Promise<DataClient> | null = null;
let liveFallback: string | null = null;

/** Set when live mode was requested but the registry could not be read. */
export function getLiveFallback(): string | null {
  return liveFallback;
}

export function resolveClient(): Promise<DataClient> {
  if (!clientPromise) {
    const liveId = import.meta.env.VITE_REGISTRY_CONTRACT as string | undefined;
    // Fixtures are the default because they are populated and always available; ?live=1
    // switches to the deployed registry so the chain path can be inspected on demand.
    const wantLive = new URLSearchParams(window.location.search).has("live");
    clientPromise =
      liveId && wantLive
        ? createLiveClient(liveId).then((c) => {
            if (!c) {
              liveFallback = "the registry returned no businesses";
              return createDemoClient();
            }
            return c;
          })
        : Promise.resolve(createDemoClient());
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

/** Vite injects the deploy base ("/" locally, "/handover/" on GitHub Pages). */
export const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function currentPath(): string {
  const p = window.location.pathname;
  return BASE && p.startsWith(BASE) ? p.slice(BASE.length) || "/" : p;
}

/** Tiny history router: pushState + popstate. No dependency, no surprises. */
export function useRoute() {
  const [path, setPath] = useState(() => currentPath());

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === currentPath()) return;
    window.history.pushState({}, "", `${BASE}${to}`);
    setPath(to);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return { path, navigate };
}
