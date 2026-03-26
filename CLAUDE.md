# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Rust project for tree-sitter integration with the BASIC programming language. Uses Rust edition 2024.

## Build & Test Commands

```bash
cargo build            # Build the project
cargo test             # Run all tests
cargo test <name>      # Run a single test by name
cargo clippy           # Lint
cargo fmt              # Format code
cargo fmt -- --check   # Check formatting without modifying
```

## Rust Guidelines

All Rust code must conform to the Pragmatic Rust Guidelines (October 2025) enforced via the `rust-development` skill. When a file is fully compliant, add `// Rust guideline compliant {date}` where `{date}` is the guideline version date.
