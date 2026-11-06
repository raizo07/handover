# CHARTER — dev entry points.
# Portable: no absolute paths, no secrets. Everything runs against testnet or a local
# sandbox. `make deploy` and `make demo` are added when the code behind them exists.

CONTRACTS := contracts/vault contracts/registry

.PHONY: test build fmt clean

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
