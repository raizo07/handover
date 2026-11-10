import { useState } from "react";
import type { Business, Receipt, Rules } from "../lib/types";
import type { DataClient } from "../lib/client";
import { near } from "../lib/format";
import { Bars, Btn, Chip, KV, LiveNumber, Panel } from "../components/ui";
import { CharterPanel, FeedPanel, OperatorPanel, RotationPanel } from "../components/panels";

export function BusinessPage({
  b,
  client,
  now,
  navigate,
  onReceipt,
  toast,
}: {
  b: Business;
  client: DataClient;
  now: number;
  navigate: (to: string) => void;
  onReceipt: (r: Receipt) => void;
  toast: (text: string, tone?: "ok" | "bad" | "plain") => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<Receipt>, okText?: string) => {
    setBusy(label);
    try {
      const r = await fn();
      onReceipt(r);
      toast(r.ok ? (okText ?? r.message) : `${r.code ?? "failed"} · ${r.message}`, r.ok ? "ok" : "bad");
    } finally {
      setBusy(null);
    }
  };

  const claim = b.stats.revenueTotal - b.stats.claimedTotal;

  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <Btn sm variant="ghost" onClick={() => navigate("/")}>
          ← all businesses
        </Btn>
      </div>

      <header className="biz-head">
        <div>
          <div className="eyebrow">
            {b.kind} · {b.tokenId} · epoch {b.epoch}
          </div>
          <h1>{b.name}</h1>
          <p className="dim" style={{ maxWidth: "52ch", marginTop: 8 }}>{b.tagline}</p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {b.stats.halted ? <Chip tone="bad">operator halted</Chip> : <Chip tone="ok">operator live</Chip>}
          <Chip>{b.vault}</Chip>
        </div>
      </header>

      <div className="cols">
        <div className="stack">
          <Panel
            title="Treasury"
            right={<span className="faint small mono">claim pays unclaimed − claimed</span>}
          >
            <div className="row between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="metric-label">unclaimed dividend</div>
                <LiveNumber value={claim} suffix="NEAR" />
              </div>
              <Btn
                primary
                onClick={() => run("claim", () => client.claim(b.tokenId), "dividend paid")}
                disabled={busy !== null || claim === 0n || !client.capabilities.vaultActions}
                title={
                  !client.capabilities.vaultActions
                    ? "Signed by the business key you downloaded, not by a wallet."
                    : claim === 0n
                      ? "Nothing to claim yet"
                      : undefined
                }
              >
                {busy === "claim" ? "claiming…" : "claim"}
              </Btn>
            </div>

            <hr className="rule" />
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="panel-title">revenue · 30d</span>
              <span className="faint small mono">{near(b.stats.revenueTotal)} NEAR lifetime</span>
            </div>
            <Bars data={b.history} />

            <hr className="rule" />
            <KV
              pairs={[
                ["lifetime revenue", `${near(b.stats.revenueTotal)} NEAR`],
                ["already claimed", `${near(b.stats.claimedTotal)} NEAR`],
                ["treasury estimate", `${near(b.stats.treasuryEstimate)} NEAR`],
                ["holder", b.holder],
              ]}
            />
          </Panel>

          <FeedPanel b={b} now={now} />
        </div>

        <div className="stack">
          <RotationPanel
            b={b}
            busy={busy}
            onResolve={() => run("resolve", () => client.resolveRotation(b.tokenId))}
            onStartTransfer={() => navigate(`/b/${b.tokenId}/buy`)}
          />

          <OperatorPanel
            b={b}
            now={now}
            busy={busy}
            locked={!client.capabilities.vaultActions}
            onReplay={() => run("replay", () => client.replayOperator(b.tokenId))}
            onHalt={() => run("halt", () => client.halt(b.tokenId), "operator key deleted")}
            onResume={() =>
              run(
                "resume",
                async () => {
                  const { generateOwnerKey } = await import("../lib/keys");
                  const key = generateOwnerKey(`${b.tokenId}-operator`);
                  return client.resume(b.tokenId, key);
                },
                "operator re-armed",
              )
            }
            onSpend={(to, amount) =>
              run("spend", () => client.operatorSpend(b.tokenId, to, amount))
            }
          />

          <CharterPanel
            b={b}
            now={now}
            busy={busy}
            locked={!client.capabilities.vaultActions}
            onPropose={(rules: Rules) => run("propose", () => client.proposeRules(b.tokenId, rules), "change proposed")}
            onApply={() => run("apply", () => client.applyRules(b.tokenId), "charter updated")}
            onCancel={() => run("cancel", () => client.cancelRules(b.tokenId), "change cancelled")}
          />
        </div>
      </div>
    </>
  );
}
