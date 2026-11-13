#!/usr/bin/env node
/**
 * Validate a FREEHOLD submission payload against the hackathon contract.
 *
 * This script never sends anything. It reads deploy-out/submission.json, checks every
 * field against the published rules, prints the exact body and the curl command, and
 * persists the requestId so a retry after a network error reuses the same value.
 *
 * The payload contains personal data, so it lives in deploy-out/ (git-ignored) and is
 * never committed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(REPO, "deploy-out/submission.json");
const OUT = join(REPO, "deploy-out/submission.body.json");

const TRACKS = [
  "defi", "thesis", "privacy", "business", "swarms", "security", "agents",
  "realworld", "games", "nfts", "memecoins", "social", "open",
];
const SIZES = ["1", "2 - 4", "4 - 6", "6 - 8", "8+"];
const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

if (!existsSync(FILE)) {
  console.error(`${red("✗")} no ${FILE}`);
  console.error("  copy the shape below and fill it in; it is git-ignored");
  console.error(
    JSON.stringify(
      {
        projectName: "",
        leadName: "",
        email: "",
        size: "1",
        tracks: [],
        nearAddress: "",
        projectUrl: "https://github.com/raizo07/freehold",
        demoUrl: "",
        idea: "",
        consent: false,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const raw = JSON.parse(readFileSync(FILE, "utf8"));
// requestId is generated once and kept across retries
const requestId = raw.requestId || randomUUID();
const body = {
  requestId,
  projectName: raw.projectName,
  leadName: raw.leadName,
  email: raw.email,
  size: raw.size,
  tracks: raw.tracks,
  nearAddress: raw.nearAddress,
  projectUrl: raw.projectUrl,
  demoUrl: raw.demoUrl,
  idea: raw.idea,
  consent: raw.consent,
};

const errors = [];
const check = (field, ok, msg) => {
  if (!ok) errors.push(`${field}: ${msg}`);
};

check("projectName", typeof body.projectName === "string" && body.projectName.length >= 2 && body.projectName.length <= 80, "2–80 characters");
check("leadName", typeof body.leadName === "string" && body.leadName.length >= 2 && body.leadName.length <= 80, "2–80 characters");
check("email", typeof body.email === "string" && body.email.length <= 160 && EMAIL_RE.test(body.email), "valid email, ≤160 chars");
check("size", SIZES.includes(body.size), `one of ${SIZES.join(" | ")}`);
check(
  "tracks",
  Array.isArray(body.tracks) && body.tracks.length > 0 && body.tracks.every((t) => TRACKS.includes(t)) && new Set(body.tracks).size === body.tracks.length,
  "one or more valid ids, no duplicates",
);
check(
  "nearAddress",
  typeof body.nearAddress === "string" && body.nearAddress.length >= 2 && body.nearAddress.length <= 64 && body.nearAddress === body.nearAddress.toLowerCase() && ACCOUNT_RE.test(body.nearAddress),
  "2–64 chars, lowercase, valid account id",
);
check(
  "projectUrl",
  /^https?:\/\/.+/.test(body.projectUrl ?? "") && body.projectUrl.length <= 300,
  "http(s) URL, ≤300 chars",
);
check("demoUrl", /^https?:\/\/.+/.test(body.demoUrl ?? "") && body.demoUrl.length <= 300, "http(s) URL of the public post, ≤300 chars");
check("idea", typeof body.idea === "string" && body.idea.length >= 20 && body.idea.length <= 2000, "20–2000 characters");
check("consent", body.consent === true, "must be true only after the contact notice was read out");
check("website", body.website === undefined, "must not be present — it is a spam trap");

const json = JSON.stringify(body, null, 2);
const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
check("size", bytes <= 12000, `body is ${bytes} bytes, limit 12000`);

writeFileSync(FILE, JSON.stringify({ ...raw, requestId }, null, 2));

console.log(`\nrequestId ${dim(requestId)}  ${dim(`(${bytes} bytes)`)}\n`);
console.log(json);

if (errors.length) {
  console.log(`\n${red(`${errors.length} field(s) still need attention`)}`);
  for (const e of errors) console.log(`  ${red("✗")} ${e}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(body));
console.log(`\n${green("payload is valid")}\n`);
console.log("This script does not send. When the human says go:\n");
console.log(
  `  curl -sS -X POST https://nearhackathon.com/api/applications \\\n` +
    `    -H 'Content-Type: application/json' \\\n` +
    `    --data @deploy-out/submission.body.json\n`,
);
