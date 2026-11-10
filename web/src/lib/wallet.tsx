/** Wallet connection.
 *
 *  NEAR Connect handles the wallet handshakes (injected, popup, deeplink); this module
 *  owns the state machine around it so the UI can render every phase honestly:
 *  manifest still loading, no wallets found, connecting, connected, error, disconnected.
 *
 *  The connected account is the user's *identity*. It is deliberately not the same thing
 *  as a vault's owner key: a vault is controlled by a bearer key that the buy flow
 *  generates and the user downloads. Wallet sessions therefore cover registry actions
 *  (buy / sell / repair a rotation); vault actions are signed by the business key.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NearConnector, type WalletManifest, type Account } from "@hot-labs/near-connect";

export type WalletPhase = "loading" | "ready" | "connecting" | "connected" | "error";

export interface WalletState {
  phase: WalletPhase;
  account: string | null;
  accounts: Account[];
  wallets: WalletManifest[];
  error: string | null;
}

interface WalletApi extends WalletState {
  connect: (walletId?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refresh: () => void;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** connector for near-kit's fromNearConnect adapter */
  connector: NearConnector | null;
}

const Ctx = createContext<WalletApi | null>(null);
const LAST_WALLET = "handover.wallet.v1";

let singleton: NearConnector | null = null;
function getConnector(): NearConnector {
  if (!singleton) {
    singleton = new NearConnector({
      network: "testnet",
      autoConnect: true,
      footerBranding: null,
    });
  }
  return singleton;
}

function describe(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel/i.test(msg)) return "Request cancelled in the wallet.";
  if (/network|fetch|load/i.test(msg)) return "Could not reach the wallet service. Check your connection and retry.";
  return msg.slice(0, 160);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    phase: "loading",
    account: null,
    accounts: [],
    wallets: [],
    error: null,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const connectorRef = useRef<NearConnector | null>(null);

  const applyAccounts = useCallback((accounts: Account[]) => {
    const first = accounts[0];
    setState((s) => ({
      ...s,
      phase: accounts.length > 0 ? "connected" : "ready",
      account: first?.accountId ?? null,
      accounts,
      error: null,
    }));
  }, []);

  const loadWallets = useCallback(async () => {
    const c = connectorRef.current;
    if (!c) return;
    try {
      await c.whenManifestLoaded;
      const wallets = c.availableWallets.map((w) => w.manifest);
      setState((s) => ({
        ...s,
        phase: s.phase === "connected" ? "connected" : "ready",
        wallets,
        error: wallets.length === 0 ? "No wallets were offered by the connector." : null,
      }));
    } catch (e) {
      setState((s) => ({ ...s, phase: "error", error: describe(e) }));
    }
  }, []);

  useEffect(() => {
    const c = getConnector();
    connectorRef.current = c;

    const onSignIn = (payload: { accounts: Account[]; success: boolean }) => {
      if (payload?.success) applyAccounts(payload.accounts ?? []);
      setState((s) => ({ ...s, phase: payload?.success ? "connected" : "ready" }));
    };
    const onSignOut = () => applyAccounts([]);

    Promise.resolve(c.on?.("wallet:signIn", onSignIn)).catch(() => {});
    Promise.resolve(c.on?.("wallet:signOut", onSignOut)).catch(() => {});

    loadWallets();
    c.getConnectedWallet()
      .then(({ accounts }) => accounts?.length && applyAccounts(accounts))
      .catch(() => {
        /* not connected: expected on first load */
      });

    return () => {
      try {
        c.events?.off?.("wallet:signIn", onSignIn);
        c.events?.off?.("wallet:signOut", onSignOut);
      } catch {
        /* emitter shape differs between versions; not fatal */
      }
    };
  }, [applyAccounts, loadWallets]);

  const connect = useCallback(
    async (walletId?: string): Promise<boolean> => {
      const c = connectorRef.current;
      if (!c) return false;
      setState((s) => ({ ...s, phase: "connecting", error: null }));
      try {
        const wallet = await c.connect(walletId ? { walletId } : undefined);
        const accounts = await wallet.getAccounts({ network: "testnet" });
        applyAccounts(accounts);
        if (walletId) localStorage.setItem(LAST_WALLET, walletId);
        setModalOpen(false);
        return accounts.length > 0;
      } catch (e) {
        setState((s) => ({ ...s, phase: "ready", error: describe(e) }));
        return false;
      }
    },
    [applyAccounts],
  );

  const disconnect = useCallback(async () => {
    const c = connectorRef.current;
    if (!c) return;
    try {
      const { wallet } = await c.getConnectedWallet();
      await c.disconnect(wallet);
    } catch {
      /* already gone */
    }
    localStorage.removeItem(LAST_WALLET);
    applyAccounts([]);
  }, [applyAccounts]);

  const api = useMemo<WalletApi>(
    () => ({
      ...state,
      connect,
      disconnect,
      refresh: loadWallets,
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      connector: getConnector(),
    }),
    [state, connect, disconnect, loadWallets, modalOpen],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}

/** Used by the live data client to sign registry actions. */
export function connectorInstance(): NearConnector {
  return getConnector();
}
