# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-26

### Added

- **MS BASIC 2.0 grammar** (`tree-sitter-msbasic2`)
  - Core statements: `PRINT`, `LET`, `INPUT`, `READ`/`DATA`/`RESTORE`, `GOTO`, `GOSUB`/`RETURN`, `ON...GOTO`/`GOSUB`, `FOR`/`NEXT`, `IF`/`THEN`/`ELSE`, `DIM`, `DEF FN`, `POKE`, `REM`, `END`, `STOP`
  - Direct-mode commands: `CLEAR`, `CONT`, `LIST`, `RUN`, `NEW`, `LOAD`, `SAVE`
  - `USR()` function call
  - Full expression precedence (14 levels) with flat `binary_expression` nodes
  - 30+ built-in functions, user-defined `FN` functions
  - Literals: integers, floats, hex (`&H`), octal (`&O`), strings
  - Variables with type sigils (`$`, `%`, `!`, `#`) and array subscripts
  - Line numbers required, multi-statement lines with `:`, `?` as `PRINT` alias
  - Syntax highlighting queries
  - 23 tree-sitter tests, 2 Rust integration tests

- **GW-BASIC grammar** (`tree-sitter-gwbasic`) — superset of MS BASIC 2.0
  - File I/O: `OPEN`, `CLOSE`, `GET`, `PUT`, `PRINT#`, `INPUT#`, `LINE INPUT#`, `WRITE#`, `FIELD`, `LSET`, `RSET`
  - Graphics: `SCREEN`, `LINE`, `CIRCLE`, `DRAW`, `PAINT`, `PSET`/`PRESET`, `COLOR`, `PALETTE`, `VIEW`, `WINDOW`, `PCOPY`
  - Sound: `PLAY`, `SOUND`, `BEEP`
  - Screen/keyboard: `KEY`, `LOCATE`, `CLS`, `WIDTH`
  - Memory: `DEF SEG`, `BLOAD`, `BSAVE`
  - Error handling: `ON ERROR GOTO`, `RESUME`
  - Program chaining: `CHAIN`, `COMMON`
  - Event trapping: `ON TIMER GOSUB`, `ON KEY GOSUB`, `TIMER ON`/`OFF`/`STOP`
  - Control flow: `WHILE`/`WEND`, `SWAP`, `LINE INPUT`
  - Apostrophe (`'`) comments
  - 27 tree-sitter tests, 2 Rust integration tests

- **QBasic grammar** (`tree-sitter-qbasic`) — superset of GW-BASIC
  - Block control flow: `IF`/`ELSEIF`/`ELSE`/`END IF`, `SELECT CASE`/`END SELECT`, `DO`/`LOOP` with `WHILE`/`UNTIL`
  - Procedures: `SUB`/`END SUB`, `FUNCTION`/`END FUNCTION`, `DECLARE`, `CALL`, `STATIC` modifier
  - User-defined types: `TYPE`/`END TYPE`, member access with `.`
  - Scoping: `CONST`, `SHARED`, `STATIC`, `DIM SHARED`, `DIM x AS type`
  - `EXIT FOR`/`DO`/`SUB`/`FUNCTION`
  - Named labels as `GOTO`/`GOSUB` targets, line numbers optional
  - 34 tree-sitter tests, 2 Rust integration tests

- **Shared grammar core** (`grammars/common/common.js`)
  - Factory-based composition with feature flags
  - Case-insensitive keyword matching via regex
  - Reusable across all three dialects

- **Build tooling**
  - Cargo workspace with three independently publishable crates
  - Makefile with `generate`, `test-grammar`, `build`, `test`, `all`, `clean`, `publish-prep` targets
  - `tree-sitter.json` per grammar for CLI integration

[0.1.0]: https://github.com/aovestdipaperino/legacy-basic-tree-sitter/releases/tag/v0.1.0
