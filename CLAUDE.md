# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Monorepo containing three tree-sitter grammars for 80s BASIC dialects:
- **MS BASIC 2.0** (`grammars/msbasic2/`) — Minimal dialect, strict line numbers
- **GW-BASIC** (`grammars/gwbasic/`) — Adds file I/O, graphics, sound, error handling
- **QBasic** (`grammars/qbasic/`) — Adds structured programming (SUB/FUNCTION, block IF, SELECT CASE, DO/LOOP, TYPE)

Each dialect has its own tree-sitter grammar, Rust crate, test corpus, and highlight queries. Shared rules live in `grammars/common/common.js`.

## Build & Test Commands

```bash
make generate          # Run tree-sitter generate for all grammars
make test-grammar      # Run tree-sitter test for all grammars
make build             # Generate + cargo build --workspace
make test              # tree-sitter test + cargo test --workspace
make all               # generate + test (full validation)
make clean             # Remove generated files and cargo artifacts

# Single dialect
cd grammars/<dialect> && tree-sitter generate   # Generate one grammar
cd grammars/<dialect> && tree-sitter test       # Test one grammar
cargo build -p tree-sitter-<dialect>            # Build one crate
cargo test -p tree-sitter-<dialect>             # Test one crate
cargo clippy --workspace                        # Lint all crates
```

## Architecture

### Grammar Composition
`grammars/common/common.js` exports a `commonRules(config)` factory. Each dialect's `grammar.js` calls it with feature flags and spreads the returned rules, then adds dialect-specific statements. Composition uses arrays (`statementChoices`, `primaryChoices`) spread into `choice()`.

### Key tree-sitter patterns
- `program` must be the first rule in each grammar.js (tree-sitter start symbol)
- Token precedence: `line_number` at prec(1), `integer_literal` at prec(-1), `identifier` at prec(-2)
- Expressions use flat `binary_expression` with `prec.left()` levels, not chained wrapper nodes
- QBasic block statements (block_if, select_case, do) are peers of `line` in the program rule

### Cargo Workspace
Three crates under `crates/`: `tree-sitter-msbasic2`, `tree-sitter-gwbasic`, `tree-sitter-qbasic`. Each compiles generated C parser via `cc` crate. For publishing, run `make publish-prep` first.

## Rust Guidelines

All Rust code must conform to the Pragmatic Rust Guidelines (October 2025) enforced via the `rust-development` skill.
