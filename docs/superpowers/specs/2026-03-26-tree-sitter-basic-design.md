# Tree-Sitter BASIC Design Spec

## Purpose

Build tree-sitter grammars for three 80s BASIC dialects — Microsoft BASIC 2.0, GW-BASIC, and QBasic — targeting high-fidelity parsing for code analysis: migration/transpilation, documentation/understanding, and static analysis of legacy programs.

## Architecture

Monorepo with three tree-sitter grammars sharing a common core via JavaScript module imports.

### Repository Structure

```
tree-sitter-basic/
  grammars/
    common/
      common.js               # Shared grammar rules (expressions, core statements)
    msbasic2/
      grammar.js              # MS BASIC 2.0 — extends common
      tree-sitter.json        # Grammar config for tree-sitter CLI
      queries/
        highlights.scm
      test/corpus/             # Tree-sitter test files
    gwbasic/
      grammar.js              # GW-BASIC — extends common + adds I/O, graphics, sound
      tree-sitter.json
      queries/
        highlights.scm
      test/corpus/
    qbasic/
      grammar.js              # QBasic — extends common + adds structured programming
      tree-sitter.json
      queries/
        highlights.scm
      test/corpus/
  crates/
    tree-sitter-msbasic2/
      Cargo.toml
      src/lib.rs
      build.rs
    tree-sitter-gwbasic/
      Cargo.toml
      src/lib.rs
      build.rs
    tree-sitter-qbasic/
      Cargo.toml
      src/lib.rs
      build.rs
  examples/                    # Real BASIC programs per dialect
    msbasic2/
    gwbasic/
    qbasic/
  Cargo.toml                   # Workspace root ([workspace] only, no [package])
  package.json                 # Configures all three grammars via "grammars" array
  Makefile                     # Automates generate/test/build for all dialects
```

The existing `src/main.rs` placeholder will be removed. The root `Cargo.toml` becomes a pure `[workspace]` with `members = ["crates/*"]`.

### Generated Files

Running `tree-sitter generate` inside a grammar directory (e.g., `grammars/msbasic2/`) produces:

```
grammars/msbasic2/
  src/
    parser.c          # Generated parser
    grammar.json      # Generated JSON form
    node-types.json   # Generated node types
    tree_sitter/      # Generated headers
```

Each crate's `build.rs` references the generated files via relative path (e.g., `../../grammars/msbasic2/src/parser.c`). The `Cargo.toml` `include` field ensures only the needed files are published to crates.io.

### Tree-Sitter CLI Configuration

The root `package.json` uses tree-sitter's `"grammars"` array to register all three grammars:

```json
{
  "tree-sitter": [
    { "path": "grammars/msbasic2" },
    { "path": "grammars/gwbasic" },
    { "path": "grammars/qbasic" }
  ]
}
```

Each grammar directory also has its own `tree-sitter.json` with grammar name, scope, and file-type associations for standalone use.

### Cargo Workspace

Root `Cargo.toml` is a workspace only (no `[package]`):

```toml
[workspace]
members = ["crates/*"]
```

Each crate follows the standard tree-sitter pattern:
- `tree-sitter-language = "0.1"` (runtime)
- `cc = "1"` (build dep, compiles generated `parser.c`)
- `tree-sitter = "0.25"` (dev dep, for tests)

Each crate is independently publishable to crates.io.

### Grammar Composition

`grammars/common/common.js` exports a factory function that takes a configuration object specifying which optional features to include, and returns a grammar rules object. Each dialect's `grammar.js` calls this factory with its feature set, then merges the result with dialect-specific rules using tree-sitter's `grammar()` function.

Feature exclusion mechanism: the factory accepts a config like `{ while_wend: true, swap: true, line_input: true }`. Features default to `false`. Each dialect opts in to the common features it supports. This avoids the problem of a dialect inheriting rules it does not actually have.

Dialect grammars can also override any common rule by defining it locally — tree-sitter uses the last definition when rules collide in the merge.

## Common Grammar Core

Shared rules present in all three dialects.

### Expressions (full precedence tree)

Operator precedence (lowest to highest):
1. `IMP`
2. `EQV`
3. `XOR`
4. `OR`
5. `AND`
6. `NOT` (unary)
7. Relational: `=`, `<>`, `<`, `>`, `<=`, `>=`
8. Additive: `+`, `-`
9. `MOD`
10. Integer division: `\`
11. Multiplicative: `*`, `/`
12. Exponentiation: `^`
13. Unary: `+`, `-`
14. Atoms: literals, variables, function calls, parenthesized expressions

### Literals

- Integers: `42`, `-7`
- Floats: `3.14`, `1.5E10`, with type suffixes `!` (single), `#` (double)
- Hex: `&HFF`
- Octal: `&O77`
- Strings: `"hello world"`

### Variables

- Bare names: `A`, `COUNT`
- Type sigils: `A$` (string), `A%` (integer), `A!` (single), `A#` (double)
- Array subscripts: `A(1)`, `B(I,J)`

### Function Calls

- Built-in: `LEFT$(A$,3)`, `MID$(A$,2,4)`, `INT(X)`, `RND(1)`, `CHR$(65)`, `ASC("A")`, `LEN(A$)`, `VAL(S$)`, `STR$(N)`, `ABS(X)`, `SQR(X)`, `SIN(X)`, `COS(X)`, `TAN(X)`, `ATN(X)`, `LOG(X)`, `EXP(X)`, `SGN(X)`, `PEEK(addr)`, `POS(0)`, `TAB(n)`, `SPC(n)`, `INSTR()`, `STRING$()`, `SPACE$()`
- User-defined: `FN` prefix (e.g., `FNSUM(A,B)`)
- Parsed as `function_call` nodes with name + argument list

### Core Statements

| Statement | Syntax |
|-----------|--------|
| LET | `[LET] var = expr` |
| PRINT / ? | `PRINT expr {;/,} expr ...` with `TAB()`, `SPC()`. `?` is an alias for `PRINT`. |
| INPUT | `INPUT ["prompt";] var {, var}` |
| LINE INPUT | `LINE INPUT ["prompt";] var` |
| READ | `READ var {, var}` |
| DATA | `DATA literal {, literal}` |
| RESTORE | `RESTORE [line]` |
| GOTO | `GOTO line` |
| GOSUB/RETURN | `GOSUB line` / `RETURN` |
| ON GOTO/GOSUB | `ON expr GOTO line {, line}` |
| FOR/NEXT | `FOR var = expr TO expr [STEP expr]` / `NEXT [var]` |
| IF/THEN/ELSE | `IF expr THEN stmt [ELSE stmt]` (single-line) |
| DIM | `DIM var(dims) {, var(dims)}` |
| DEF FN | `DEF FNname(params) = expr` |
| REM | `REM ...` (rest of line is comment) |
| END | `END` |
| STOP | `STOP` |
| POKE | `POKE addr, value` |

### Structural Elements

- **Line numbers**: Required prefix in MS BASIC 2.0 / GW-BASIC, optional in QBasic
- **Multi-statement lines**: `:` separator (e.g., `10 A=1:B=2:PRINT A+B`)
- **Case insensitivity**: Keywords matched via case-insensitive regex patterns (e.g., `/[Pp][Rr][Ii][Nn][Tt]/`). Note: this approach expands the generated parser's state table. If parser size becomes problematic, an external scanner using `tolower()` comparison is the fallback. This should be benchmarked early.

## Dialect-Specific Extensions

### MS BASIC 2.0

Minimal dialect. Strict line numbers required on every line.

Common core features enabled: all except `WHILE/WEND`, `SWAP`, `LINE INPUT`.

Additional statements:
- `CLEAR`, `CONT`, `LIST`, `RUN`, `NEW`, `LOAD`, `SAVE` (direct-mode commands)
- `USR()` function call

No file I/O, no graphics, no block structures.

### GW-BASIC

Superset of MS BASIC 2.0. Still requires line numbers.

Common core features enabled: all (including `WHILE/WEND`, `SWAP`, `LINE INPUT`).

**File I/O:**
- `OPEN`, `CLOSE`, `GET`, `PUT`
- `PRINT#`, `INPUT#`, `LINE INPUT#`, `WRITE#`
- `FIELD`, `LSET`, `RSET`
- `EOF()`, `LOC()`, `LOF()`

**Graphics:**
- `SCREEN`, `LINE`, `CIRCLE`, `DRAW`, `PAINT`
- `PSET`, `PRESET`, `COLOR`, `PALETTE`
- `VIEW`, `WINDOW`
- `POINT()`, `PCOPY`

**Sound:**
- `PLAY`, `SOUND`, `BEEP`

**Screen/keyboard:**
- `KEY`, `LOCATE`, `CLS`, `WIDTH`
- `INKEY$`

**Memory:**
- `DEF SEG`, `BLOAD`, `BSAVE`

**Error handling:**
- `ON ERROR GOTO`, `RESUME`, `RESUME NEXT`
- `ERR`, `ERL`

**Program chaining:**
- `CHAIN`, `MERGE`, `COMMON`

**Event trapping:**
- `ON TIMER GOSUB`, `ON KEY GOSUB`
- `TIMER ON/OFF/STOP`, `KEY ON/OFF/STOP`

### QBasic

Superset of GW-BASIC. Line numbers become optional; labels (e.g., `MyLabel:`) serve as branch targets.

Common core features enabled: all.

**Block control flow:**
- `IF`/`THEN`/`ELSEIF`/`ELSE`/`END IF` (multi-line block form)
- `SELECT CASE`/`CASE`/`CASE IS`/`CASE ELSE`/`END SELECT`
- `DO`/`LOOP` with `WHILE`/`UNTIL` (pre or post condition)
- `EXIT FOR`, `EXIT DO`, `EXIT SUB`, `EXIT FUNCTION`

**Procedures:**
- `SUB name (params)`/`END SUB`
- `FUNCTION name (params)`/`END FUNCTION`
- `DECLARE SUB`, `DECLARE FUNCTION`
- `CALL name(args)`

**User-defined types:**
- `TYPE name`/`END TYPE` with member declarations
- Member access: `variable.member`

**Variable scoping:**
- `SHARED` (module-level access from within SUB/FUNCTION)
- `STATIC` (preserve values between calls)
- `CONST` (named constants)
- `DIM SHARED`

## Error Handling & Robustness

- Tree-sitter's built-in error recovery handles incomplete/malformed programs — unrecognized tokens produce `ERROR` nodes while surrounding valid code parses normally
- No custom external scanner (`scanner.c`) initially — BASIC syntax is regular enough for the grammar DSL
- External scanner can be added later if needed (e.g., `DATA` statement raw values, `DRAW` mini-language strings, or case-insensitive keyword matching if regex-based approach produces oversized parsers)

## Testing Strategy

### Tree-sitter test corpus

Each dialect has its own corpus under `grammars/<dialect>/test/corpus/` using tree-sitter's native test format:

```
================
Test name
================
10 PRINT "HELLO"
---
(program
  (line
    (line_number)
    (print_statement
      (string_literal))))
```

### Coverage targets per dialect

- Every statement type
- Expression precedence edge cases
- Multi-statement lines
- Error recovery (intentionally malformed input)
- Real-world example programs in `examples/`

### Rust-side tests

Each crate verifies grammar loading and basic parsing in `lib.rs` tests.

## Build Workflow

### Manual (single dialect)

1. Edit `grammar.js` for the target dialect
2. `cd grammars/<dialect> && tree-sitter generate` — produces `src/parser.c`
3. `tree-sitter test` — validates against test corpus
4. `cargo build` / `cargo test` from repo root — builds and tests Rust bindings

### Automated (all dialects)

A root `Makefile` provides targets:

```makefile
generate:     # Run tree-sitter generate for all three grammars
test-grammar: # Run tree-sitter test for all three grammars
build:        # cargo build --workspace
test:         # test-grammar + cargo test --workspace
all:          # generate + test
```

This ensures all three grammars stay in sync and prevents drift between dialects.
