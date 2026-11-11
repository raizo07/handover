# HANDOVER — dev entry points.
# Portable: no absolute paths, no secrets. Contracts run against a local sandbox;
# the frontend runs on generated demo data. `make deploy` lands when an account exists.

CONTRACTS := contracts/vault contracts/registry

.PHONY: test build fmt clean web-install web-dev web-build demo deploy deploy-dry deploy-sandbox pages

## Run unit + sandbox integration tests for both contracts.
test:
	@for c in $(CONTRACTS); do \
		echo "== $$c"; \
		(cd $$c && cargo test) || exit 1; \
	done

## Build release wasm for both contracts.
build:
	@for c in $(CONTRACTS); do \
		echo "== $$c"; \
		(cd $$c && cargo near build non-reproducible-wasm) || exit 1; \
	done

fmt:
	@for c in $(CONTRACTS); do (cd $$c && cargo fmt); done

clean:
	@for c in $(CONTRACTS); do (cd $$c && rm -rf target); done

## Install frontend deps (reproducible from the lockfile).
web-install:
	cd web && npm ci

## Frontend dev server on http://localhost:5173
web-dev:
	cd web && npm run dev

## Production build of the frontend.
web-build:
	cd web && npm run build

## Build the app and serve it on http://localhost:4173 — the judge path.
demo: web-install web-build
	cd web && npm run preview

## Deploy + seed to testnet using .env (needs a funded named account).
deploy:
	cd web && node scripts/deploy.mjs

## Show exactly what deploy would do, without touching the network.
deploy-dry:
	cd web && node scripts/deploy.mjs --dry-run

## Full rehearsal of deploy + seed against a local NEAR node (downloads it once).
deploy-sandbox:
	cd web && node scripts/deploy.mjs --sandbox

## Build with the GitHub Pages base path and publish to the gh-pages branch.
pages:
	./web/scripts/publish-pages.sh

## Rebuild the two-minute film (needs ffmpeg, python3+numpy, Chrome).
film:
	cd film && npm ci && python3 plan.py && python3 score.py && node render.mjs
