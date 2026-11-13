# Deploying to Vercel

The app is ready to deploy; only authentication is missing. The CLI token in
`~/Library/Application Support/com.vercel.cli/auth.json` is expired — Vercel's API returns
`403 forbidden` for it — so a deploy cannot run until you re-authenticate.

## Once you are logged in

```bash
cd web
npx vercel deploy --prod --yes --build-env VITE_REGISTRY_CONTRACT=freehold.raizo07.testnet
```

That is the whole deploy. The first run creates the project and prints the production URL.

## If you prefer not to log in on this machine

Create a token at <https://vercel.com/account/tokens> and save it somewhere only you can read:

```bash
umask 077 && printf '%s' 'PASTE_TOKEN_HERE' > ~/.vercel-token
```

Then I can deploy without ever printing it:

```bash
cd web && VERCEL_TOKEN="$(cat ~/.vercel-token)" npx vercel deploy --prod --yes \
  --build-env VITE_REGISTRY_CONTRACT=freehold.raizo07.testnet
```

## Or connect the repository instead

Import `raizo07/freehold` in the Vercel dashboard, set the **root directory** to `web`, add
the environment variable `VITE_REGISTRY_CONTRACT=freehold.raizo07.testnet`, and every push
to `main` deploys. No token needed on this machine.

## What is already configured

- `web/vercel.json` — framework `vite`, `dist` as output, and a rewrite that sends every
  non-asset path to `index.html`. Without it `/judge`, `/b/biz-7` and `/keys` would 404,
  because the app routes on the client.
- The build runs at base `/`, unlike GitHub Pages which needs `/freehold/`. `vite.config`
  sets no base, so Vercel gets root-relative assets; the router reads `BASE_URL`, so it
  adapts either way.
- `VITE_REGISTRY_CONTRACT` is injected at build time, so the deployed bundle reads
  `freehold.raizo07.testnet` when you open `?live=1`.

## Check after deploying

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/            # 200
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/judge       # 200 (rewrite works)
```

Then open `https://<your-url>/?live=1` and confirm the badge reads `TESTNET · LIVE` and shows
three businesses.
