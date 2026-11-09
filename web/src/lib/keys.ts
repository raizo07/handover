/** Owner keys: generated in the browser, never derived from the wallet.
 *
 *  A vault grants full access to a *public key*, not to an account name, so the buy
 *  flow has to mint a keypair locally. That makes the key a bearer instrument: lose
 *  the download, lose the business. The UI says so in plain words and blocks the
 *  transfer until the file exists on disk.
 */

import { KeyPair } from "@near-js/crypto";
import type { OwnerKey } from "./types";

const STORE = "handover.keys.v1";

export function generateOwnerKey(label: string): OwnerKey {
  const kp = KeyPair.fromRandom("ed25519");
  return {
    id: crypto.randomUUID(),
    publicKey: kp.getPublicKey().toString(),
    secretKey: kp.toString(),
    label,
    createdAt: Date.now(),
  };
}

export function importOwnerKey(secret: string, label: string): OwnerKey {
  const kp = KeyPair.fromString(secret as Parameters<typeof KeyPair.fromString>[0]);
  return {
    id: crypto.randomUUID(),
    publicKey: kp.getPublicKey().toString(),
    secretKey: secret,
    label,
    createdAt: Date.now(),
  };
}

export function loadKeys(): OwnerKey[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]") as OwnerKey[];
  } catch {
    return [];
  }
}

export function saveKeys(keys: OwnerKey[]) {
  localStorage.setItem(STORE, JSON.stringify(keys));
}

export function addKey(key: OwnerKey) {
  const keys = loadKeys().filter((k) => k.publicKey !== key.publicKey);
  saveKeys([key, ...keys]);
}

export function removeKey(id: string) {
  saveKeys(loadKeys().filter((k) => k.id !== id));
}

export function downloadKey(key: OwnerKey) {
  const body = {
    format: "handover-owner-key/v1",
    label: key.label,
    publicKey: key.publicKey,
    secretKey: key.secretKey,
    warning:
      "This key controls a vault on NEAR testnet. Anyone holding the secret key can claim its dividends. Do not share this file.",
    createdAt: new Date(key.createdAt).toISOString(),
  };
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `handover-${key.label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-${key.publicKey.slice(8, 16)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
