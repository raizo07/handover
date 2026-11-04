# Build notes — what was verified, not assumed

Everything here was run, and the output is quoted. If a future step contradicts a line
below, this file is wrong and must be updated.

## Toolchain as verified on 2026-11-04

| Tool | Version | Note |
|---|---|---|
| rustc / cargo | 1.99.0 | `wasm32-unknown-unknown` target installed |
| cargo-near | 0.22.0 | installed with `cargo install cargo-near --locked` |
| near-sdk | **`=5.29.0`** | exact pin, see below |
| near-sandbox | 0.3.12 | from the `cargo near new` template |

## The pin: near-sdk `=5.29.0`, not `5.30.X`

`cargo near build` reported:

```
INFO: contract's near-sdk targets protocol version 88; rustc 1.99.0 accepted
```

and every sandbox integration test then failed at `DeployContract` with:

```
FunctionCallError(ExecutionError("Link Error: unknown or invalid import"))
```

The wasm imports host functions that the pinned `near-sandbox` 0.3.12 VM does not
implement. Pinning `near-sdk = "=5.29.0"` yields:

```
INFO: contract's near-sdk targets protocol version 84
```

and the sandbox tests pass. Two traps worth remembering:

1. `near-sdk = "5.29"` is a **caret range** — it resolves to 5.30 and silently
   reintroduces the failure. The `=` is load-bearing.
2. `cargo-near` caches build artifacts in `target/near/` and will happily redeploy the
   *old* hash. After changing SDK versions, `rm -rf target/near` before trusting a test
   result.

## Test output (both crates)

```
running 7 tests
test result: ok. 7 passed; 0 failed
running 1 test
test test_contract_is_operational ... ok
test result: ok. 1 passed; 0 failed
```

## Sandboxed build environment

This project was built inside a file sandbox where only the workspace is writable.
`cargo near` writes config to `$HOME` and the registry to `$CARGO_HOME`, so builds ran
with:

```sh
HOME=$PWD/.home \
RUSTUP_HOME=$HOME_REAL/.rustup \
CARGO_HOME=$PWD/../.cargo-home \
cargo test
```

On a normal machine none of that is needed — `make test` works as written. The
variables are recorded here only so the environment can be reproduced exactly.
