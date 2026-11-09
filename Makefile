# HANDOVER — dev entry points.
# Portable: no absolute paths, no secrets. Contracts run against a local sandbox;
# the frontend runs on generated demo data. `make deploy` lands when an account exists.

CONTRACTS := contracts/vault contracts/registry

.PHONY: test build fmt clean web-install web-dev web-build demo

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
