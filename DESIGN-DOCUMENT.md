# Design Document: legacy-basic-tree-sitter

## Purpose

High-fidelity tree-sitter grammars for three 80s BASIC dialects — Microsoft BASIC 2.0, GW-BASIC, and QBasic — targeting code analysis use cases: migration/transpilation to modern languages, documentation and understanding of legacy codebases, and static analysis (dead code detection, variable tracking, control flow analysis).

## Dialect Relationships

The three dialects form a strict superset chain:

```
MS BASIC 2.0  <  GW-BASIC  <  QBasic
(~1977)          (~1983)       (~1991)
```

**Microsoft BASIC 2.0** is the minimal dialect: line numbers required on every line, no file I/O, no graphics, no block structures. Found on the Commodore 64, Apple II, and early microcomputers.

**GW-BASIC** extends MS BASIC 2.0 with file I/O (`OPEN`/`CLOSE`/`PRINT#`), graphics (`SCREEN`/`LINE`/`CIRCLE`), sound (`PLAY`/`SOUND`), error handling (`ON ERROR GOTO`), `WHILE`/`WEND` loops, and event trapping. Still requires line numbers. Shipped with MS-DOS.

**QBasic** extends GW-BASIC with structured programming: `SUB`/`FUNCTION` procedures, block `IF`/`ELSEIF`/`ELSE`/`END IF`, `SELECT CASE`, `DO`/`LOOP` with `WHILE`/`UNTIL`, user-defined `TYPE`s, and named labels. Line numbers become optional. Shipped with MS-DOS 5.0+.

## Architecture

### Monorepo with Shared Grammar Core

All three grammars live in one repository. Shared rules are factored into `grammars/common/common.js`, which each dialect imports and extends.

```
grammars/
  common/common.js        # ~300 lines: expressions, core statements, literals, variables
  msbasic2/grammar.js     # ~65 lines: imports common, adds 7 statements
  gwbasic/grammar.js      # ~250 lines: imports common, adds 40+ statements
  qbasic/grammar.js       # ~430 lines: imports common, adds block structures + procedures
```

### Grammar Composition Pattern

`common.js` exports a `commonRules(config)` factory function that returns:

```javascript
{
  rules: { ... },          // Grammar rule definitions
  statementChoices: [...], // Array of $ => $.rule_name functions
  primaryChoices: [...]    // Array of $ => $.rule_name functions
}
```

Each dialect spreads these into its own `grammar()` call:

```javascript
const common = commonRules({ while_wend: true, swap: true, ... });

module.exports = grammar({
  rules: {
    ...common.rules,
    // Override/add rules here
    statement: $ => choice(
      ...common.statementChoices.map(fn => fn($)),
      $.dialect_specific_statement,
    ),
  },
});
```

This avoids relying on tree-sitter's internal `choice()` node structure (no `.members` access). Dialects opt-in to common features via config flags (`while_wend`, `swap`, `line_input`, `apostrophe_comment`), and can override any common rule by redefining it.

### Why Not One Permissive Grammar?

Three separate grammars (rather than one accepting all dialects) because:
1. Dialect-specific analysis can reject out-of-dialect constructs at parse time
2. AST node types are precise — `SUB` definitions only appear in the QBasic grammar
3. Each grammar's test corpus validates its exact dialect
4. Separate crates allow users to depend on only the dialect they need

## Expression Design

### Flat Binary Expression with Precedence Levels

Expressions use a single `binary_expression` rule with `prec.left()` / `prec.right()` instead of chaining precedence levels through wrapper nodes:

```javascript
binary_expression: $ => choice(
  prec.left(1,  seq($.expression, kw("IMP"), $.expression)),
  prec.left(2,  seq($.expression, kw("EQV"), $.expression)),
  // ...
  prec.left(11, seq($.expression, choice("*", "/"), $.expression)),
  prec.right(12, seq($.expression, "^", $.expression)),
),
```

This produces clean, flat S-expressions:

```
(binary_expression
  (literal (integer_literal))
  "+"
  (binary_expression
    (literal (integer_literal))
    "*"
    (literal (integer_literal))))
```

Instead of deeply nested wrapper nodes like `(additive_expression (multiplicative_expression (power_expression ...)))`.

### Operator Precedence (lowest to highest)

| Level | Operators | Associativity |
|-------|-----------|--------------|
| 1 | `IMP` | Left |
| 2 | `EQV` | Left |
| 3 | `XOR` | Left |
| 4 | `OR` | Left |
| 5 | `AND` | Left |
| 6 | `NOT` (unary) | Right |
| 7 | `=`, `<>`, `<`, `>`, `<=`, `>=` | Left |
| 8 | `+`, `-` | Left |
| 9 | `MOD` | Left |
| 10 | `\` (integer division) | Left |
| 11 | `*`, `/` | Left |
| 12 | `^` (exponentiation) | Right |
| 13 | Unary `+`, `-`, `NOT` | N/A |
| 14 | Atoms (literals, variables, function calls, parenthesized) | N/A |

## Token Disambiguation

### The line_number vs integer_literal Problem

Both `line_number` and `integer_literal` match `/\d+/`. Tree-sitter resolves this with token precedence:

```javascript
line_number:      $ => token(prec(1, /\d+/)),    // Wins in line-start position
integer_literal:  $ => token(prec(-1, /\d+/)),   // Loses to line_number
identifier:       $ => token(prec(-2, /[a-zA-Z][a-zA-Z0-9]*/)),  // Loses to keywords
```

This hierarchy ensures:
- At the start of a line, digits match as `line_number`
- In expression context, digits match as `integer_literal`
- Keywords (case-insensitive regex patterns) win over `identifier`

### Case-Insensitive Keywords

BASIC keywords are case-insensitive. Tree-sitter has no built-in case-insensitive mode, so each keyword is a regex of character classes:

```javascript
function kw(word) {
  // kw("PRINT") => /[Pp][Rr][Ii][Nn][Tt]/
}
```

This expands the generated parser's state table but keeps parser sizes manageable (9k–37k lines of C). An external scanner with `tolower()` comparison is the fallback if parser size becomes problematic in the future.

## QBasic Block Statements

### Peers of Line, Not Children

QBasic's block statements (`IF`/`END IF`, `SELECT CASE`/`END SELECT`, `DO`/`LOOP`) span multiple lines. They cannot be children of a single `line` node because `line` expects to end with a newline.

Block statements are peers of `line` in the `program` rule:

```javascript
program: $ => repeat(choice(
  $.block_if_statement,
  $.select_case_statement,
  $.do_statement,
  $.sub_definition,
  $.function_definition,
  $.type_definition,
  $.line,
  /\r?\n/
)),
```

Block bodies contain the same set of alternatives, enabling arbitrary nesting:

```javascript
function blockBody($) {
  return repeat(choice(
    $.line,
    $.block_if_statement,
    $.select_case_statement,
    $.do_statement,
    /\r?\n/,
  ));
}
```

### Conflict Declarations

The `END` keyword creates GLR ambiguity — `END IF` could be parsed as an `end_statement` followed by an identifier `IF`, or as the closing delimiter of a `block_if_statement`. Explicit conflict declarations resolve these:

```javascript
conflicts: $ => [
  [$.statement_list],
  [$.if_statement],
  [$.else_clause],
  [$.elseif_clause],
  [$.case_clause],
  [$.case_else_clause],
],
```

## Cargo Workspace and Publishing

### Workspace Layout

The root `Cargo.toml` is a pure `[workspace]` (no `[package]`). Three independently publishable crates under `crates/`:

```toml
[workspace]
members = ["crates/*"]
resolver = "2"
```

### Build Pipeline

Each crate's `build.rs` compiles the generated C parser using the `cc` crate. During local development, it reads from `../../grammars/<dialect>/src/parser.c`. For crates.io publishing, `make publish-prep` copies generated sources into each crate's `grammar-src/` directory:

```rust
let grammar_src = manifest_dir.join("grammar-src");
let src_dir = if grammar_src.exists() {
    grammar_src           // Publishing: use local copy
} else {
    manifest_dir.join("../../grammars/<dialect>/src")  // Dev: use generated files
};
```

## Testing Strategy

### Tree-Sitter Test Corpus

Each dialect has its own test corpus under `grammars/<dialect>/test/corpus/` using tree-sitter's native test format:

```
================
Test Name
================
10 PRINT "HELLO"

---

(program
  (line
    (line_number)
    (statement_list
      (statement
        (print_statement ...)))))
```

Test files are organized by feature area: `expressions.txt`, `statements.txt`, `structure.txt`, `dialect_specific.txt`, `file_io.txt`, `graphics.txt`, `procedures.txt`, `block_control_flow.txt`, `types.txt`, `error_recovery.txt`.

### Rust Integration Tests

Each crate has two tests in `lib.rs`:
1. `test_can_load_grammar` — Verifies the grammar loads without error
2. `test_parse_*` — Parses a sample program and asserts no errors

### Test Coverage

| Dialect | Tree-sitter Tests | Rust Tests |
|---------|-------------------|------------|
| MS BASIC 2.0 | 23 | 2 |
| GW-BASIC | 27 | 2 |
| QBasic | 34 | 2 |
| **Total** | **84** | **6** |

## Future Considerations

- **External scanner**: If case-insensitive keyword regexes produce oversized parsers for extended grammars, a `scanner.c` with `tolower()` comparison could replace the regex approach.
- **`DATA` statement values**: Currently parsed as literals/identifiers. A future external scanner could handle the full `DATA` syntax (unquoted strings, embedded commas).
- **`DRAW` mini-language**: The `DRAW` statement takes a string containing a mini graphics language. This could be parsed via injection queries if needed.
- **Additional dialects**: The composition architecture supports adding more dialects (e.g., Turbo Basic, BASICA, Applesoft BASIC) by creating new `grammar.js` files that import from `common.js`.
