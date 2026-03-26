# legacy-basic-tree-sitter

Tree-sitter grammars for 80s BASIC dialects: **Microsoft BASIC 2.0**, **GW-BASIC**, and **QBasic**.

Built for code analysis of legacy BASIC programs — migration, transpilation, documentation, and static analysis.

## Grammars

| Crate | Dialect | Line Numbers | Key Features |
|-------|---------|-------------|--------------|
| `tree-sitter-msbasic2` | Microsoft BASIC 2.0 | Required | Core statements, `GOTO`/`GOSUB`, `FOR`/`NEXT`, `DEF FN` |
| `tree-sitter-gwbasic` | GW-BASIC | Required | File I/O, graphics, sound, `ON ERROR`, `WHILE`/`WEND`, event trapping |
| `tree-sitter-qbasic` | QBasic | Optional | `SUB`/`FUNCTION`, block `IF`, `SELECT CASE`, `DO`/`LOOP`, `TYPE`, labels |

Each dialect is a strict superset of the previous: MS BASIC 2.0 < GW-BASIC < QBasic.

## Installation

### Rust (crates.io)

```toml
# Pick the dialect(s) you need:
[dependencies]
tree-sitter-msbasic2 = "0.1"
tree-sitter-gwbasic = "0.1"
tree-sitter-qbasic = "0.1"
```

### Usage

```rust
use tree_sitter_qbasic::LANGUAGE;

let mut parser = tree_sitter::Parser::new();
parser.set_language(&LANGUAGE.into()).expect("Error loading QBasic grammar");

let source = r#"
SUB Hello (name$)
  PRINT "Hello, "; name$
END SUB

CALL Hello("World")
"#;

let tree = parser.parse(source, None).unwrap();
let root = tree.root_node();
assert_eq!(root.kind(), "program");
assert!(!root.has_error());
```

### Node.js

```bash
npm install tree-sitter-cli
```

The `package.json` at the repo root registers all three grammars for the tree-sitter CLI.

## Building from Source

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [tree-sitter CLI](https://tree-sitter.github.io/tree-sitter/): `npm install -g tree-sitter-cli`

### Commands

```bash
make all               # Generate parsers + run all tests
make generate          # Generate C parsers from grammar.js
make test-grammar      # Run tree-sitter test corpus
make build             # Generate + cargo build
make test              # Full test suite (tree-sitter + cargo)
make clean             # Remove generated files and build artifacts

# Single dialect
cd grammars/qbasic && tree-sitter generate && tree-sitter test
cargo test -p tree-sitter-qbasic
```

## Repository Structure

```
legacy-basic-tree-sitter/
  grammars/
    common/common.js            # Shared grammar rules (expressions, core statements)
    msbasic2/grammar.js         # MS BASIC 2.0 grammar
    gwbasic/grammar.js          # GW-BASIC grammar
    qbasic/grammar.js           # QBasic grammar
  crates/
    tree-sitter-msbasic2/       # Rust crate for MS BASIC 2.0
    tree-sitter-gwbasic/        # Rust crate for GW-BASIC
    tree-sitter-qbasic/         # Rust crate for QBasic
  examples/                     # Sample programs per dialect
  Cargo.toml                    # Workspace root
  Makefile                      # Build automation
```

Each grammar directory contains:
- `grammar.js` — Grammar definition (imports shared rules from `common.js`)
- `tree-sitter.json` — Tree-sitter CLI configuration
- `queries/highlights.scm` — Syntax highlighting queries
- `test/corpus/*.txt` — Test cases in tree-sitter's native format
- `src/` — Generated C parser (produced by `tree-sitter generate`)

## Supported Language Features

### All Dialects (Common Core)

- **Expressions**: Full operator precedence (14 levels) — arithmetic, string concatenation, relational, logical (`AND`, `OR`, `NOT`, `XOR`, `EQV`, `IMP`)
- **Literals**: Integers, floats (with `!`/`#`/`D` suffixes), hex (`&H`), octal (`&O`), strings
- **Variables**: Type sigils (`$`, `%`, `!`, `#`), array subscripts
- **Statements**: `PRINT`/`?`, `LET`, `INPUT`, `READ`/`DATA`/`RESTORE`, `GOTO`, `GOSUB`/`RETURN`, `ON...GOTO`/`GOSUB`, `FOR`/`NEXT`, `IF`/`THEN`/`ELSE`, `DIM`, `DEF FN`, `POKE`, `REM`, `END`, `STOP`
- **Functions**: 30+ built-in functions (`LEFT$`, `MID$`, `INT`, `RND`, `CHR$`, `ASC`, `LEN`, `VAL`, `ABS`, `SQR`, trig functions, etc.), user-defined `FN` functions
- **Structure**: Multi-statement lines with `:` separator, case-insensitive keywords

### GW-BASIC Additions

- **File I/O**: `OPEN`, `CLOSE`, `GET`, `PUT`, `PRINT#`, `INPUT#`, `LINE INPUT#`, `WRITE#`, `FIELD`, `LSET`, `RSET`
- **Graphics**: `SCREEN`, `LINE`, `CIRCLE`, `DRAW`, `PAINT`, `PSET`/`PRESET`, `COLOR`, `PALETTE`, `VIEW`, `WINDOW`
- **Sound**: `PLAY`, `SOUND`, `BEEP`
- **Screen**: `KEY`, `LOCATE`, `CLS`, `WIDTH`
- **Memory**: `DEF SEG`, `BLOAD`, `BSAVE`
- **Error Handling**: `ON ERROR GOTO`, `RESUME`
- **Control Flow**: `WHILE`/`WEND`, `SWAP`, `LINE INPUT`
- **Event Trapping**: `ON TIMER GOSUB`, `ON KEY GOSUB`
- **Comments**: `'` (apostrophe) as `REM` alias

### QBasic Additions

- **Structured Control Flow**: Block `IF`/`ELSEIF`/`ELSE`/`END IF`, `SELECT CASE`, `DO`/`LOOP` (with `WHILE`/`UNTIL`), `EXIT FOR`/`DO`/`SUB`/`FUNCTION`
- **Procedures**: `SUB`/`END SUB`, `FUNCTION`/`END FUNCTION`, `DECLARE`, `CALL`, `STATIC` modifier
- **User-Defined Types**: `TYPE`/`END TYPE`, member access with `.`
- **Scoping**: `CONST`, `SHARED`, `STATIC`, `DIM SHARED`, `DIM x AS type`
- **Labels**: Named labels (`MyLabel:`) as `GOTO`/`GOSUB` targets (line numbers optional)

## Error Recovery

All three grammars use tree-sitter's built-in error recovery. Unrecognized tokens produce `ERROR` nodes while surrounding valid code still parses into a proper AST. This makes the grammars suitable for parsing incomplete, hand-typed, or OCR-scanned programs.

## Publishing to crates.io

```bash
make publish-prep    # Copies generated C sources into each crate
cargo publish -p tree-sitter-msbasic2 --dry-run
cargo publish -p tree-sitter-gwbasic --dry-run
cargo publish -p tree-sitter-qbasic --dry-run
```

## License

MIT
