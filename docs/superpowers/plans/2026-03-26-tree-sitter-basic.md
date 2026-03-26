# Tree-Sitter BASIC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three tree-sitter grammars (MS BASIC 2.0, GW-BASIC, QBasic) in a Cargo workspace monorepo with a shared common grammar core.

**Architecture:** Each grammar is defined in `grammars/<dialect>/grammar.js`, importing shared rules from `grammars/common/common.js`. The common module exports rules AND arrays of statement/expression choices (not tree-sitter internals). Generated C parsers are compiled into Rust crates under `crates/`. A Makefile orchestrates generate/test/build across all three.

**Tech Stack:** tree-sitter CLI, JavaScript (grammar DSL), C (generated), Rust (bindings), cc crate (build)

**Spec:** `docs/superpowers/specs/2026-03-26-tree-sitter-basic-design.md`

---

## Key Design Decisions

### Expression precedence: flat binary_expression with prec levels

Instead of chaining precedence levels (which wraps every atom in N wrapper nodes), use a single `binary_expression` rule with `prec.left()`:

```javascript
expression: $ => choice($.binary_expression, $.unary_expression, $.primary_expression),
binary_expression: $ => choice(
  prec.left(1, seq($.expression, kw("IMP"), $.expression)),
  prec.left(2, seq($.expression, kw("EQV"), $.expression)),
  // ... etc
),
```

This produces clean S-expressions: `(binary_expression (literal) "+" (literal))`.

### Grammar composition: arrays, not tree-sitter internals

`commonRules()` returns a plain object with:
- `rules`: the grammar rule definitions
- `statementChoices`: array of `$ => $.rule_name` functions
- `primaryChoices`: array of `$ => $.rule_name` functions

Dialects spread these arrays into their own `choice()` calls:

```javascript
statement: $ => choice(...common.statementChoices.map(fn => fn($)), $.dialect_specific_stmt),
```

This avoids relying on undocumented `.members` API of tree-sitter choice nodes.

### Block statements (QBasic): peers of line, not children

QBasic's `block_if_statement`, `select_case_statement`, and `do_statement` span multiple lines. They must be peers of `line` in the `program` rule, not nested inside a `line`:

```javascript
program: $ => repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, ...)),
```

### Publishing: copy-based pre-publish

Each crate's `build.rs` uses relative paths for local development. A `make publish-prep` target copies generated sources into each crate for `cargo publish`.

---

## File Map

```
tree-sitter-basic/
  Cargo.toml                              # Workspace root
  package.json                            # tree-sitter multi-grammar config
  Makefile                                # generate/test/build/publish automation
  .gitignore
  grammars/
    common/
      common.js                           # Shared rules factory
    msbasic2/
      grammar.js
      tree-sitter.json
      queries/highlights.scm
      test/corpus/expressions.txt
      test/corpus/statements.txt
      test/corpus/structure.txt
      test/corpus/error_recovery.txt
    gwbasic/
      grammar.js
      tree-sitter.json
      queries/highlights.scm
      test/corpus/expressions.txt
      test/corpus/statements.txt
      test/corpus/file_io.txt
      test/corpus/graphics.txt
      test/corpus/error_recovery.txt
    qbasic/
      grammar.js
      tree-sitter.json
      queries/highlights.scm
      test/corpus/expressions.txt
      test/corpus/statements.txt
      test/corpus/procedures.txt
      test/corpus/block_control_flow.txt
      test/corpus/types.txt
      test/corpus/error_recovery.txt
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
  examples/
    msbasic2/hello.bas
    gwbasic/hello.bas
    qbasic/hello.bas
```

---

### Task 1: Project Scaffolding & Tooling

**Files:**
- Modify: `Cargo.toml`
- Modify: `.gitignore`
- Create: `package.json`
- Create: `Makefile`
- Delete: `src/main.rs`

- [ ] **Step 1: Install tree-sitter CLI**

```bash
npm install -g tree-sitter-cli
```

Verify: `tree-sitter --version` prints a version.

- [ ] **Step 2: Replace root Cargo.toml with workspace**

```toml
[workspace]
members = ["crates/*"]
resolver = "2"
```

- [ ] **Step 3: Delete src/main.rs**

```bash
rm src/main.rs && rmdir src
```

- [ ] **Step 4: Update .gitignore**

```
/target
node_modules/
```

- [ ] **Step 5: Create package.json**

```json
{
  "name": "tree-sitter-basic",
  "version": "0.1.0",
  "description": "Tree-sitter grammars for 80s BASIC dialects",
  "tree-sitter": [
    {
      "path": "grammars/msbasic2",
      "scope": "source.msbasic2",
      "file-types": ["bas"]
    },
    {
      "path": "grammars/gwbasic",
      "scope": "source.gwbasic",
      "file-types": ["bas"]
    },
    {
      "path": "grammars/qbasic",
      "scope": "source.qbasic",
      "file-types": ["bas", "bi", "bm"]
    }
  ]
}
```

- [ ] **Step 6: Create Makefile**

```makefile
DIALECTS := msbasic2 gwbasic qbasic

.PHONY: generate test-grammar build test all clean publish-prep

generate:
	@for d in $(DIALECTS); do \
		echo "=== Generating $$d ===" && \
		(cd grammars/$$d && tree-sitter generate); \
	done

test-grammar:
	@for d in $(DIALECTS); do \
		echo "=== Testing $$d ===" && \
		(cd grammars/$$d && tree-sitter test); \
	done

build: generate
	cargo build --workspace

test: test-grammar
	cargo test --workspace

all: generate test

clean:
	cargo clean
	@for d in $(DIALECTS); do \
		rm -rf grammars/$$d/src; \
	done

# Copy generated sources into crates for cargo publish
publish-prep:
	@for d in $(DIALECTS); do \
		mkdir -p crates/tree-sitter-$$d/grammar-src && \
		cp -r grammars/$$d/src/* crates/tree-sitter-$$d/grammar-src/ && \
		cp -r grammars/$$d/queries crates/tree-sitter-$$d/; \
	done
	@echo "Run 'cargo publish -p tree-sitter-<dialect>' from crate dir after this"
```

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml .gitignore package.json Makefile
git rm src/main.rs
git commit -m "feat: scaffold workspace, Makefile, and package.json for multi-grammar repo"
```

---

### Task 2: Common Grammar Core

**Files:**
- Create: `grammars/common/common.js`

This builds the entire shared grammar core in one file: helpers, literals, variables, expressions, and statements. The module exports `kw`, `commaSep`, `commaSep1`, and `commonRules`.

- [ ] **Step 1: Create common.js — complete file**

```javascript
// grammars/common/common.js
//
// Shared grammar rules for 80s BASIC dialects.
// Exports a factory that returns rules + choice arrays based on feature config.

/**
 * Case-insensitive keyword match.
 * kw("PRINT") => /[Pp][Rr][Ii][Nn][Tt]/
 */
function kw(word) {
  let pattern = "";
  for (const ch of word) {
    if (/[a-zA-Z]/.test(ch)) {
      pattern += `[${ch.toUpperCase()}${ch.toLowerCase()}]`;
    } else {
      // Escape regex-special characters
      pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(pattern);
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Build common rules for a BASIC dialect.
 *
 * @param {Object} config - Feature flags
 * @param {boolean} config.while_wend - Include WHILE/WEND
 * @param {boolean} config.swap - Include SWAP
 * @param {boolean} config.line_input - Include LINE INPUT
 * @param {boolean} config.apostrophe_comment - Include ' as comment alias
 * @returns {{ rules: Object, statementChoices: Function[], primaryChoices: Function[] }}
 */
function commonRules(config = {}) {
  // --- Literals ---
  const rules = {
    integer_literal: $ => /\d+/,

    float_literal: $ => token(seq(
      /\d+\.\d*/,
      optional(/[eEdD][+-]?\d+/),
      optional(/[!#]/)
    )),

    hex_literal: $ => /&[hH][0-9a-fA-F]+/,

    octal_literal: $ => /&[oO][0-7]+/,

    string_literal: $ => /"[^"]*"/,

    literal: $ => choice(
      $.float_literal,  // float before integer so 3.14 doesn't match as "3"
      $.integer_literal,
      $.hex_literal,
      $.octal_literal,
      $.string_literal,
    ),

    // --- Variables ---
    // Note: identifier is also used for line_number disambiguation.
    // tree-sitter handles context-dependent tokenization via grammar context.
    identifier: $ => /[a-zA-Z][a-zA-Z0-9]*/,

    type_sigil: $ => /[$%!#]/,

    variable: $ => seq(
      $.identifier,
      optional($.type_sigil),
      optional(seq("(", commaSep1($.expression), ")"))
    ),

    // --- Function calls ---
    builtin_function: $ => choice(
      token(kw("LEFT$")), token(kw("RIGHT$")), token(kw("MID$")),
      token(kw("CHR$")), token(kw("STR$")), token(kw("STRING$")), token(kw("SPACE$")),
      token(kw("INT")), token(kw("RND")), token(kw("ASC")), token(kw("LEN")),
      token(kw("VAL")), token(kw("ABS")), token(kw("SQR")), token(kw("SIN")),
      token(kw("COS")), token(kw("TAN")), token(kw("ATN")), token(kw("LOG")),
      token(kw("EXP")), token(kw("SGN")), token(kw("PEEK")), token(kw("POS")),
      token(kw("TAB")), token(kw("SPC")), token(kw("INSTR")),
      token(kw("EOF")), token(kw("LOC")), token(kw("LOF")),
      token(kw("FRE")), token(kw("POINT")),
    ),

    user_function: $ => token(seq(
      /[fF][nN]/,
      /[a-zA-Z][a-zA-Z0-9]*/
    )),

    // INKEY$ is a system variable, not a function (no parens)
    system_variable: $ => choice(
      token(kw("INKEY$")),
    ),

    function_call: $ => seq(
      choice($.builtin_function, $.user_function),
      "(", commaSep($.expression), ")"
    ),

    // --- Expressions (flat binary with prec levels) ---
    expression: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $.primary_expression,
    ),

    binary_expression: $ => choice(
      prec.left(1,  seq($.expression, kw("IMP"), $.expression)),
      prec.left(2,  seq($.expression, kw("EQV"), $.expression)),
      prec.left(3,  seq($.expression, kw("XOR"), $.expression)),
      prec.left(4,  seq($.expression, kw("OR"),  $.expression)),
      prec.left(5,  seq($.expression, kw("AND"), $.expression)),
      prec.left(7,  seq($.expression, choice("=", "<>", "<", ">", "<=", ">="), $.expression)),
      prec.left(8,  seq($.expression, choice("+", "-"), $.expression)),
      prec.left(9,  seq($.expression, kw("MOD"), $.expression)),
      prec.left(10, seq($.expression, "\\", $.expression)),
      prec.left(11, seq($.expression, choice("*", "/"), $.expression)),
      prec.right(12, seq($.expression, "^", $.expression)),
    ),

    unary_expression: $ => prec(13, choice(
      seq(kw("NOT"), $.expression),
      seq("-", $.expression),
      seq("+", $.expression),
    )),

    primary_expression: $ => prec(14, choice(
      $.literal,
      $.function_call,
      $.system_variable,
      $.variable,
      seq("(", $.expression, ")"),
    )),

    // --- Program structure ---
    line_number: $ => token(prec(1, /\d+/)),

    program: $ => repeat(choice($.line, /\r?\n/)),

    line: $ => seq(
      optional($.line_number),
      $.statement_list,
      /\r?\n/
    ),

    statement_list: $ => seq(
      $.statement,
      repeat(seq(":", $.statement))
    ),

    // --- Comments ---
    comment: $ => token(seq(kw("REM"), /.*/)),

    // --- Statements ---
    print_statement: $ => seq(
      choice(kw("PRINT"), "?"),
      optional($.print_list)
    ),
    print_list: $ => seq(
      $.print_item,
      repeat(seq(choice(";", ","), optional($.print_item)))
    ),
    print_item: $ => $.expression,

    let_statement: $ => seq(
      optional(kw("LET")),
      $.variable,
      "=",
      $.expression
    ),

    input_statement: $ => seq(
      kw("INPUT"),
      optional(seq($.string_literal, ";")),
      commaSep1($.variable)
    ),

    read_statement: $ => seq(kw("READ"), commaSep1($.variable)),

    data_statement: $ => seq(kw("DATA"), commaSep1(choice($.literal, $.identifier))),

    restore_statement: $ => seq(kw("RESTORE"), optional($.line_number)),

    goto_statement: $ => seq(kw("GOTO"), $.line_number),

    gosub_statement: $ => seq(kw("GOSUB"), $.line_number),

    return_statement: $ => kw("RETURN"),

    on_goto_statement: $ => seq(
      kw("ON"), $.expression,
      choice(kw("GOTO"), kw("GOSUB")),
      commaSep1($.line_number)
    ),

    for_statement: $ => seq(
      kw("FOR"), $.variable, "=", $.expression,
      kw("TO"), $.expression,
      optional(seq(kw("STEP"), $.expression))
    ),

    next_statement: $ => seq(kw("NEXT"), optional(commaSep1($.variable))),

    if_statement: $ => seq(
      kw("IF"), $.expression, kw("THEN"),
      choice($.line_number, $.statement_list),
      optional(seq(kw("ELSE"), choice($.line_number, $.statement_list)))
    ),

    dim_statement: $ => seq(kw("DIM"), commaSep1($.dim_variable)),
    dim_variable: $ => seq(
      $.identifier,
      optional($.type_sigil),
      "(", commaSep1($.expression), ")"
    ),

    def_fn_statement: $ => seq(
      kw("DEF"),
      $.user_function,
      optional(seq("(", commaSep1($.variable), ")")),
      "=",
      $.expression
    ),

    end_statement: $ => kw("END"),
    stop_statement: $ => kw("STOP"),
    poke_statement: $ => seq(kw("POKE"), $.expression, ",", $.expression),
  };

  // Feature-gated statements
  if (config.while_wend) {
    rules.while_statement = $ => seq(kw("WHILE"), $.expression);
    rules.wend_statement = $ => kw("WEND");
  }
  if (config.swap) {
    rules.swap_statement = $ => seq(kw("SWAP"), $.variable, ",", $.variable);
  }
  if (config.line_input) {
    rules.line_input_statement = $ => seq(
      kw("LINE"), kw("INPUT"),
      optional(seq($.string_literal, ";")),
      $.variable
    );
  }
  if (config.apostrophe_comment) {
    rules.apostrophe_comment = $ => token(seq("'", /.*/));
  }

  // Build statement choices as an array of functions
  const statementChoices = [
    $ => $.comment,
    $ => $.print_statement,
    $ => $.let_statement,
    $ => $.input_statement,
    $ => $.read_statement,
    $ => $.data_statement,
    $ => $.restore_statement,
    $ => $.goto_statement,
    $ => $.gosub_statement,
    $ => $.return_statement,
    $ => $.on_goto_statement,
    $ => $.for_statement,
    $ => $.next_statement,
    $ => $.if_statement,
    $ => $.dim_statement,
    $ => $.def_fn_statement,
    $ => $.end_statement,
    $ => $.stop_statement,
    $ => $.poke_statement,
  ];
  if (config.while_wend) {
    statementChoices.push($ => $.while_statement, $ => $.wend_statement);
  }
  if (config.swap) {
    statementChoices.push($ => $.swap_statement);
  }
  if (config.line_input) {
    statementChoices.push($ => $.line_input_statement);
  }
  if (config.apostrophe_comment) {
    statementChoices.push($ => $.apostrophe_comment);
  }

  // Primary expression choices
  const primaryChoices = [
    $ => $.literal,
    $ => $.function_call,
    $ => $.system_variable,
    $ => $.variable,
    $ => seq("(", $.expression, ")"),
  ];

  return { rules, statementChoices, primaryChoices };
}

module.exports = { kw, commaSep, commaSep1, commonRules };
```

- [ ] **Step 2: Commit**

```bash
git add grammars/common/common.js
git commit -m "feat: add common grammar core — expressions, statements, literals, variables"
```

---

### Task 3: MS BASIC 2.0 Grammar, Tests, and Rust Crate

**Files:**
- Create: `grammars/msbasic2/grammar.js`
- Create: `grammars/msbasic2/tree-sitter.json`
- Create: `grammars/msbasic2/test/corpus/expressions.txt`
- Create: `grammars/msbasic2/test/corpus/statements.txt`
- Create: `grammars/msbasic2/test/corpus/structure.txt`
- Create: `grammars/msbasic2/test/corpus/error_recovery.txt`
- Create: `grammars/msbasic2/queries/highlights.scm`
- Create: `crates/tree-sitter-msbasic2/Cargo.toml`
- Create: `crates/tree-sitter-msbasic2/src/lib.rs`
- Create: `crates/tree-sitter-msbasic2/build.rs`
- Create: `examples/msbasic2/hello.bas`

- [ ] **Step 1: Create grammar.js**

```javascript
const { kw, commaSep, commaSep1, commonRules } = require("../common/common");

const common = commonRules({
  while_wend: false,
  swap: false,
  line_input: false,
  apostrophe_comment: false,
});

module.exports = grammar({
  name: "msbasic2",

  extras: $ => [/[ \t]/],

  rules: {
    ...common.rules,

    // MS BASIC 2.0: line numbers REQUIRED
    line: $ => seq($.line_number, $.statement_list, /\r?\n/),

    // MS BASIC 2.0 specific
    clear_statement: $ => seq(kw("CLEAR"), optional($.expression)),
    cont_statement: $ => kw("CONT"),
    list_statement: $ => seq(kw("LIST"), optional(seq(
      optional($.line_number), optional(seq("-", optional($.line_number)))
    ))),
    run_statement: $ => seq(kw("RUN"), optional($.line_number)),
    new_statement: $ => kw("NEW"),
    load_statement: $ => seq(kw("LOAD"), $.string_literal),
    save_statement: $ => seq(kw("SAVE"), $.string_literal),
    usr_call: $ => seq(kw("USR"), "(", $.expression, ")"),

    statement: $ => choice(
      ...common.statementChoices.map(fn => fn($)),
      $.clear_statement,
      $.cont_statement,
      $.list_statement,
      $.run_statement,
      $.new_statement,
      $.load_statement,
      $.save_statement,
    ),

    primary_expression: $ => prec(14, choice(
      ...common.primaryChoices.map(fn => fn($)),
      $.usr_call,
    )),
  },
});
```

- [ ] **Step 2: Create tree-sitter.json**

```json
{
  "name": "msbasic2",
  "version": "0.1.0",
  "scope": "source.msbasic2",
  "file-types": ["bas"],
  "injection-regex": "msbasic2"
}
```

- [ ] **Step 3: Write expressions.txt**

Note: with the flat `binary_expression` approach, `1+2*3` becomes:
```
(binary_expression
  (literal (integer_literal))
  (binary_expression (literal (integer_literal)) (literal (integer_literal))))
```

```
================
Integer arithmetic
================
10 A=1+2*3

---

(program
  (line
    (line_number)
    (statement_list
      (let_statement
        (variable (identifier))
        (binary_expression
          (literal (integer_literal))
          (binary_expression
            (literal (integer_literal))
            (literal (integer_literal))))))))

================
String variable assignment
================
10 A$="HELLO"

---

(program
  (line
    (line_number)
    (statement_list
      (let_statement
        (variable (identifier) (type_sigil))
        (literal (string_literal))))))

================
Relational in IF
================
10 IF A>B THEN 20

---

(program
  (line
    (line_number)
    (statement_list
      (if_statement
        (binary_expression
          (variable (identifier))
          (variable (identifier)))
        (line_number)))))

================
Parenthesized expression
================
10 A=(1+2)*3

---

(program
  (line
    (line_number)
    (statement_list
      (let_statement
        (variable (identifier))
        (binary_expression
          (primary_expression
            (binary_expression
              (literal (integer_literal))
              (literal (integer_literal))))
          (literal (integer_literal)))))))
```

Note: Exact S-expression shapes may need adjustment after running `tree-sitter generate`. Run `tree-sitter parse` on sample inputs to discover the actual tree shape, then update tests to match.

- [ ] **Step 4: Write statements.txt**

```
================
PRINT with semicolons
================
10 PRINT "HELLO";"WORLD"

---

(program
  (line
    (line_number)
    (statement_list
      (print_statement
        (print_list
          (print_item (literal (string_literal)))
          (print_item (literal (string_literal))))))))

================
Question mark as PRINT
================
10 ? "HELLO"

---

(program
  (line
    (line_number)
    (statement_list
      (print_statement
        (print_list
          (print_item (literal (string_literal))))))))

================
FOR NEXT loop
================
10 FOR I=1 TO 10
20 PRINT I
30 NEXT I

---

(program
  (line
    (line_number)
    (statement_list
      (for_statement
        (variable (identifier))
        (literal (integer_literal))
        (literal (integer_literal)))))
  (line
    (line_number)
    (statement_list
      (print_statement
        (print_list
          (print_item (variable (identifier)))))))
  (line
    (line_number)
    (statement_list
      (next_statement (variable (identifier))))))

================
GOSUB and RETURN
================
10 GOSUB 100
20 END
100 PRINT "SUB"
110 RETURN

---

(program
  (line (line_number) (statement_list (gosub_statement (line_number))))
  (line (line_number) (statement_list (end_statement)))
  (line (line_number) (statement_list (print_statement (print_list (print_item (literal (string_literal)))))))
  (line (line_number) (statement_list (return_statement))))

================
DATA and READ
================
10 DATA 1,2,3
20 READ A,B,C

---

(program
  (line (line_number) (statement_list (data_statement (literal (integer_literal)) (literal (integer_literal)) (literal (integer_literal)))))
  (line (line_number) (statement_list (read_statement (variable (identifier)) (variable (identifier)) (variable (identifier))))))
```

- [ ] **Step 5: Write structure.txt**

```
================
Multi-statement line
================
10 A=1:B=2:PRINT A

---

(program
  (line
    (line_number)
    (statement_list
      (let_statement (variable (identifier)) (literal (integer_literal)))
      (let_statement (variable (identifier)) (literal (integer_literal)))
      (print_statement (print_list (print_item (variable (identifier))))))))

================
REM comment
================
10 REM THIS IS A COMMENT

---

(program
  (line
    (line_number)
    (statement_list
      (comment))))
```

- [ ] **Step 6: Write error_recovery.txt**

```
================
Missing line number still parses following lines
================
PRINT "OOPS"
10 PRINT "OK"

---

(program
  (ERROR)
  (line
    (line_number)
    (statement_list
      (print_statement (print_list (print_item (literal (string_literal))))))))

================
Unknown keyword produces error node
================
10 FROBNICATE
20 PRINT "FINE"

---

(program
  (line (line_number) (statement_list (ERROR)))
  (line (line_number) (statement_list (print_statement (print_list (print_item (literal (string_literal))))))))
```

Note: Error recovery S-expressions will need refinement — tree-sitter's recovery is non-deterministic. The important thing is that valid lines after errors still parse correctly.

- [ ] **Step 7: Generate parser and run tests**

```bash
cd grammars/msbasic2 && tree-sitter generate
```

Expected: creates `grammars/msbasic2/src/parser.c`.

Then discover actual S-expression shapes:

```bash
cd grammars/msbasic2 && echo '10 PRINT "HELLO"' | tree-sitter parse --scope source.msbasic2 /dev/stdin
```

Update test corpus S-expressions to match actual output. Then:

```bash
cd grammars/msbasic2 && tree-sitter test
```

Iterate until all tests pass.

- [ ] **Step 8: Create highlights.scm**

```scheme
(line_number) @constant.numeric
(integer_literal) @constant.numeric
(float_literal) @constant.numeric
(hex_literal) @constant.numeric
(octal_literal) @constant.numeric
(string_literal) @string
(comment) @comment
(identifier) @variable
(type_sigil) @punctuation.special
(builtin_function) @function.builtin
(user_function) @function
```

- [ ] **Step 9: Create Cargo.toml**

```toml
[package]
name = "tree-sitter-msbasic2"
version = "0.1.0"
edition = "2021"
description = "Tree-sitter grammar for Microsoft BASIC 2.0"
license = "MIT"
build = "build.rs"
autoexamples = false
include = [
  "Cargo.toml",
  "build.rs",
  "src/**",
  "grammar-src/**",
  "queries/**",
]

[lib]
path = "src/lib.rs"

[dependencies]
tree-sitter-language = "0.1"

[build-dependencies]
cc = "1"

[dev-dependencies]
tree-sitter = "0.25"
```

Note: `grammar-src/` is populated by `make publish-prep` for crates.io publishing. During local dev, `build.rs` reads from `../../grammars/msbasic2/src/`.

- [ ] **Step 10: Create build.rs**

```rust
fn main() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").unwrap()
    );

    // During local dev, use the grammar source directly.
    // For publishing, `make publish-prep` copies into grammar-src/.
    let grammar_src = manifest_dir.join("grammar-src");
    let src_dir = if grammar_src.exists() {
        grammar_src
    } else {
        manifest_dir.join("../../grammars/msbasic2/src")
    };

    let mut c_config = cc::Build::new();
    c_config.std("c11").include(&src_dir);

    #[cfg(target_env = "msvc")]
    c_config.flag("-utf-8");

    let parser_path = src_dir.join("parser.c");
    c_config.file(&parser_path);
    println!("cargo:rerun-if-changed={}", parser_path.display());

    let scanner_path = src_dir.join("scanner.c");
    if scanner_path.exists() {
        c_config.file(&scanner_path);
        println!("cargo:rerun-if-changed={}", scanner_path.display());
    }

    c_config.compile("tree-sitter-msbasic2");
}
```

- [ ] **Step 11: Create src/lib.rs**

```rust
use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_msbasic2() -> *const ();
}

/// Language function for Microsoft BASIC 2.0.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_msbasic2) };

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading msbasic2 parser");
    }

    #[test]
    fn test_parse_hello_world() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading msbasic2 parser");
        let tree = parser
            .parse("10 PRINT \"HELLO WORLD\"\n", None)
            .expect("Failed to parse");
        let root = tree.root_node();
        assert_eq!(root.kind(), "program");
        assert!(!root.has_error());
    }
}
```

- [ ] **Step 12: Create example program**

`examples/msbasic2/hello.bas`:
```basic
10 REM HELLO WORLD IN MS BASIC 2.0
20 PRINT "HELLO, WORLD!"
30 FOR I=1 TO 5
40 PRINT I;" SQUARED =";I*I
50 NEXT I
60 END
```

- [ ] **Step 13: Build and test Rust crate**

```bash
cargo build -p tree-sitter-msbasic2 && cargo test -p tree-sitter-msbasic2
```

Expected: both pass.

- [ ] **Step 14: Commit**

```bash
git add grammars/msbasic2 crates/tree-sitter-msbasic2 examples/msbasic2
git commit -m "feat: add MS BASIC 2.0 grammar, tests, and Rust crate"
```

---

### Task 4: GW-BASIC Grammar, Tests, and Rust Crate

**Files:**
- Create: `grammars/gwbasic/grammar.js`
- Create: `grammars/gwbasic/tree-sitter.json`
- Create: `grammars/gwbasic/test/corpus/expressions.txt`
- Create: `grammars/gwbasic/test/corpus/statements.txt`
- Create: `grammars/gwbasic/test/corpus/file_io.txt`
- Create: `grammars/gwbasic/test/corpus/graphics.txt`
- Create: `grammars/gwbasic/test/corpus/error_recovery.txt`
- Create: `grammars/gwbasic/queries/highlights.scm`
- Create: `crates/tree-sitter-gwbasic/Cargo.toml`
- Create: `crates/tree-sitter-gwbasic/src/lib.rs`
- Create: `crates/tree-sitter-gwbasic/build.rs`
- Create: `examples/gwbasic/hello.bas`

- [ ] **Step 1: Create grammar.js**

GW-BASIC imports common with `while_wend`, `swap`, `line_input`, and `apostrophe_comment` all enabled. Adds file I/O, graphics, sound, screen/keyboard, memory, error handling, program chaining, and event trapping statements. Includes all MS BASIC 2.0 extras.

```javascript
const { kw, commaSep, commaSep1, commonRules } = require("../common/common");

const common = commonRules({
  while_wend: true,
  swap: true,
  line_input: true,
  apostrophe_comment: true,
});

module.exports = grammar({
  name: "gwbasic",

  extras: $ => [/[ \t]/],

  rules: {
    ...common.rules,

    // GW-BASIC: line numbers required
    line: $ => seq($.line_number, $.statement_list, /\r?\n/),

    // --- File I/O ---
    open_statement: $ => seq(
      kw("OPEN"), $.expression,
      optional(seq(kw("FOR"), choice(kw("INPUT"), kw("OUTPUT"), kw("APPEND"), kw("RANDOM"), kw("BINARY")))),
      kw("AS"), optional("#"), $.expression,
      optional(seq(kw("LEN"), "=", $.expression))
    ),
    close_statement: $ => seq(kw("CLOSE"), optional(seq(optional("#"), commaSep1($.expression)))),
    get_statement: $ => seq(kw("GET"), optional("#"), $.expression, optional(seq(",", $.expression))),
    put_statement: $ => seq(kw("PUT"), optional("#"), $.expression, optional(seq(",", $.expression))),
    print_file_statement: $ => seq(kw("PRINT"), "#", $.expression, ",", optional($.print_list)),
    input_file_statement: $ => seq(kw("INPUT"), "#", $.expression, ",", commaSep1($.variable)),
    line_input_file_statement: $ => seq(kw("LINE"), kw("INPUT"), "#", $.expression, ",", $.variable),
    write_file_statement: $ => seq(kw("WRITE"), "#", $.expression, optional(seq(",", commaSep($.expression)))),
    field_statement: $ => seq(kw("FIELD"), optional("#"), $.expression, ",", commaSep1(seq($.expression, kw("AS"), $.variable))),
    lset_statement: $ => seq(kw("LSET"), $.variable, "=", $.expression),
    rset_statement: $ => seq(kw("RSET"), $.variable, "=", $.expression),

    // --- Graphics ---
    screen_statement: $ => seq(kw("SCREEN"), commaSep1($.expression)),
    line_graph_statement: $ => seq(
      kw("LINE"),
      optional(seq("(", $.expression, ",", $.expression, ")")),
      "-", "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression)),
      optional(seq(",", choice(token(kw("B")), token(kw("BF")))))
    ),
    circle_statement: $ => seq(
      kw("CIRCLE"), "(", $.expression, ",", $.expression, ")",
      ",", $.expression,
      optional(seq(",", $.expression,
        optional(seq(",", $.expression,
          optional(seq(",", $.expression))))))
    ),
    draw_statement: $ => seq(kw("DRAW"), $.expression),
    paint_statement: $ => seq(
      kw("PAINT"), "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression, optional(seq(",", $.expression))))
    ),
    pset_statement: $ => seq(
      choice(kw("PSET"), kw("PRESET")),
      "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression))
    ),
    color_statement: $ => seq(kw("COLOR"), commaSep1($.expression)),
    palette_statement: $ => seq(kw("PALETTE"), optional(seq($.expression, ",", $.expression))),
    view_statement: $ => seq(
      kw("VIEW"), optional(kw("PRINT")),
      optional(seq("(", $.expression, ",", $.expression, ")",
        "-", "(", $.expression, ",", $.expression, ")"))
    ),
    window_statement: $ => seq(
      kw("WINDOW"),
      optional(seq("(", $.expression, ",", $.expression, ")",
        "-", "(", $.expression, ",", $.expression, ")"))
    ),
    pcopy_statement: $ => seq(kw("PCOPY"), $.expression, ",", $.expression),

    // --- Sound ---
    play_statement: $ => seq(kw("PLAY"), $.expression),
    sound_statement: $ => seq(kw("SOUND"), $.expression, ",", $.expression),
    beep_statement: $ => kw("BEEP"),

    // --- Screen/keyboard ---
    key_statement: $ => seq(kw("KEY"), choice(
      seq($.expression, ",", $.expression),
      kw("ON"), kw("OFF"), kw("LIST")
    )),
    locate_statement: $ => seq(kw("LOCATE"), commaSep($.expression)),
    cls_statement: $ => seq(kw("CLS"), optional($.expression)),
    width_statement: $ => seq(kw("WIDTH"), commaSep1($.expression)),

    // --- Memory ---
    def_seg_statement: $ => seq(kw("DEF"), kw("SEG"), optional(seq("=", $.expression))),
    bload_statement: $ => seq(kw("BLOAD"), $.expression, optional(seq(",", $.expression))),
    bsave_statement: $ => seq(kw("BSAVE"), $.expression, ",", $.expression, ",", $.expression),

    // --- Error handling ---
    on_error_statement: $ => seq(kw("ON"), kw("ERROR"), kw("GOTO"), $.line_number),
    resume_statement: $ => seq(kw("RESUME"), optional(choice(kw("NEXT"), $.line_number))),

    // --- Program chaining ---
    chain_statement: $ => seq(kw("CHAIN"), optional(kw("MERGE")), $.expression, optional(seq(",", $.expression))),
    common_var_statement: $ => seq(kw("COMMON"), commaSep1($.variable)),

    // --- Event trapping ---
    on_timer_statement: $ => seq(kw("ON"), kw("TIMER"), "(", $.expression, ")", kw("GOSUB"), $.line_number),
    on_key_statement: $ => seq(kw("ON"), kw("KEY"), "(", $.expression, ")", kw("GOSUB"), $.line_number),
    timer_control_statement: $ => seq(kw("TIMER"), choice(kw("ON"), kw("OFF"), kw("STOP"))),
    key_control_statement: $ => seq(kw("KEY"), "(", $.expression, ")", choice(kw("ON"), kw("OFF"), kw("STOP"))),

    // --- MS BASIC 2.0 extras ---
    clear_statement: $ => seq(kw("CLEAR"), optional(seq(",", $.expression, optional(seq(",", $.expression))))),
    cont_statement: $ => kw("CONT"),
    list_statement: $ => seq(kw("LIST"), optional(seq(
      optional($.line_number), optional(seq("-", optional($.line_number)))
    ))),
    run_statement: $ => seq(kw("RUN"), optional(choice($.line_number, $.string_literal))),
    usr_call: $ => seq(kw("USR"), "(", $.expression, ")"),

    statement: $ => choice(
      ...common.statementChoices.map(fn => fn($)),
      // File I/O
      $.open_statement, $.close_statement, $.get_statement, $.put_statement,
      $.print_file_statement, $.input_file_statement, $.line_input_file_statement,
      $.write_file_statement, $.field_statement, $.lset_statement, $.rset_statement,
      // Graphics
      $.screen_statement, $.line_graph_statement, $.circle_statement,
      $.draw_statement, $.paint_statement, $.pset_statement,
      $.color_statement, $.palette_statement, $.view_statement, $.window_statement,
      $.pcopy_statement,
      // Sound
      $.play_statement, $.sound_statement, $.beep_statement,
      // Screen/keyboard
      $.key_statement, $.locate_statement, $.cls_statement, $.width_statement,
      // Memory
      $.def_seg_statement, $.bload_statement, $.bsave_statement,
      // Error handling
      $.on_error_statement, $.resume_statement,
      // Program chaining
      $.chain_statement, $.common_var_statement,
      // Event trapping
      $.on_timer_statement, $.on_key_statement,
      $.timer_control_statement, $.key_control_statement,
      // MS BASIC 2.0 extras
      $.clear_statement, $.cont_statement, $.list_statement, $.run_statement,
    ),

    primary_expression: $ => prec(14, choice(
      ...common.primaryChoices.map(fn => fn($)),
      $.usr_call,
    )),
  },
});
```

- [ ] **Step 2: Create tree-sitter.json**

```json
{
  "name": "gwbasic",
  "version": "0.1.0",
  "scope": "source.gwbasic",
  "file-types": ["bas"],
  "injection-regex": "gwbasic"
}
```

- [ ] **Step 3: Write test corpora**

Create these files following the same S-expression pattern as msbasic2. Key tests to include:

`expressions.txt`: same arithmetic/relational tests as msbasic2 (line numbers required).

`statements.txt`: WHILE/WEND, SWAP, LINE INPUT, apostrophe comments:
```
================
WHILE WEND
================
10 WHILE A<10
20 A=A+1
30 WEND

---

(program
  (line (line_number) (statement_list (while_statement (binary_expression (variable (identifier)) (literal (integer_literal))))))
  (line (line_number) (statement_list (let_statement (variable (identifier)) (binary_expression (variable (identifier)) (literal (integer_literal))))))
  (line (line_number) (statement_list (wend_statement))))

================
Apostrophe comment
================
10 A=1 ' SET A TO 1

---

(program
  (line (line_number) (statement_list (let_statement (variable (identifier)) (literal (integer_literal))) (apostrophe_comment))))
```

`file_io.txt`: OPEN/CLOSE/INPUT#/PRINT# tests.

`graphics.txt`: SCREEN, COLOR, PSET tests.

`error_recovery.txt`: malformed lines followed by valid lines.

Run `tree-sitter parse` on sample inputs to discover actual S-expression shapes and update tests accordingly.

- [ ] **Step 4: Generate parser and run tests**

```bash
cd grammars/gwbasic && tree-sitter generate && tree-sitter test
```

Iterate until all tests pass.

- [ ] **Step 5: Create highlights.scm, Rust crate files**

Same structure as msbasic2 — change `msbasic2` to `gwbasic` throughout:
- `grammars/gwbasic/queries/highlights.scm` — same content as msbasic2
- `crates/tree-sitter-gwbasic/Cargo.toml` — same structure, name = "tree-sitter-gwbasic"
- `crates/tree-sitter-gwbasic/build.rs` — same structure, paths point to `gwbasic`
- `crates/tree-sitter-gwbasic/src/lib.rs` — same structure, `tree_sitter_gwbasic` symbol

- [ ] **Step 6: Create example program**

`examples/gwbasic/hello.bas`:
```basic
10 REM GW-BASIC DEMO
20 SCREEN 1
30 COLOR 1,0
40 FOR I=1 TO 100
50 PSET (RND*320,RND*200),RND*4
60 NEXT I
70 SOUND 440,18
80 PRINT "DONE"
90 END
```

- [ ] **Step 7: Build and test Rust crate**

```bash
cargo build -p tree-sitter-gwbasic && cargo test -p tree-sitter-gwbasic
```

- [ ] **Step 8: Commit**

```bash
git add grammars/gwbasic crates/tree-sitter-gwbasic examples/gwbasic
git commit -m "feat: add GW-BASIC grammar, tests, and Rust crate"
```

---

### Task 5: QBasic Grammar, Tests, and Rust Crate

**Files:**
- Create: `grammars/qbasic/grammar.js`
- Create: `grammars/qbasic/tree-sitter.json`
- Create: `grammars/qbasic/test/corpus/expressions.txt`
- Create: `grammars/qbasic/test/corpus/statements.txt`
- Create: `grammars/qbasic/test/corpus/procedures.txt`
- Create: `grammars/qbasic/test/corpus/block_control_flow.txt`
- Create: `grammars/qbasic/test/corpus/types.txt`
- Create: `grammars/qbasic/test/corpus/error_recovery.txt`
- Create: `grammars/qbasic/queries/highlights.scm`
- Create: `crates/tree-sitter-qbasic/Cargo.toml`
- Create: `crates/tree-sitter-qbasic/src/lib.rs`
- Create: `crates/tree-sitter-qbasic/build.rs`
- Create: `examples/qbasic/hello.bas`

- [ ] **Step 1: Create grammar.js**

QBasic is a superset of GW-BASIC. It reuses all common rules, adds all GW-BASIC statements, plus block control flow, procedures, types, and scoping. Line numbers are optional; labels supported. Block statements (`block_if`, `select_case`, `do_loop`) are peers of `line` in `program`, not children of `line`.

```javascript
const { kw, commaSep, commaSep1, commonRules } = require("../common/common");

const common = commonRules({
  while_wend: true,
  swap: true,
  line_input: true,
  apostrophe_comment: true,
});

module.exports = grammar({
  name: "qbasic",

  extras: $ => [/[ \t]/],

  rules: {
    ...common.rules,

    // QBasic: line numbers optional, labels supported, block statements at program level
    program: $ => repeat(choice(
      $.line,
      $.block_if_statement,
      $.select_case_statement,
      $.do_statement,
      $.sub_definition,
      $.function_definition,
      $.type_definition,
      /\r?\n/
    )),

    line: $ => seq(
      optional(choice($.line_number, $.label)),
      $.statement_list,
      /\r?\n/
    ),

    label: $ => seq($.identifier, ":"),

    // --- Block IF (peer of line) ---
    block_if_statement: $ => seq(
      kw("IF"), $.expression, kw("THEN"), /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/)),
      repeat($.elseif_clause),
      optional($.else_clause),
      kw("END"), kw("IF"), /\r?\n/
    ),
    elseif_clause: $ => seq(
      kw("ELSEIF"), $.expression, kw("THEN"), /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/))
    ),
    else_clause: $ => seq(
      kw("ELSE"), /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/))
    ),

    // --- SELECT CASE (peer of line) ---
    select_case_statement: $ => seq(
      kw("SELECT"), kw("CASE"), $.expression, /\r?\n/,
      repeat($.case_clause),
      optional($.case_else_clause),
      kw("END"), kw("SELECT"), /\r?\n/
    ),
    case_clause: $ => seq(
      kw("CASE"), $.case_specifier_list, /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/))
    ),
    case_else_clause: $ => seq(
      kw("CASE"), kw("ELSE"), /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/))
    ),
    case_specifier_list: $ => commaSep1($.case_specifier),
    case_specifier: $ => choice(
      seq(kw("IS"), choice("=", "<>", "<", ">", "<=", ">="), $.expression),
      seq($.expression, kw("TO"), $.expression),
      $.expression
    ),

    // --- DO/LOOP (peer of line) ---
    do_statement: $ => choice(
      seq(kw("DO"), choice(kw("WHILE"), kw("UNTIL")), $.expression, /\r?\n/,
        repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/)),
        kw("LOOP"), /\r?\n/),
      seq(kw("DO"), /\r?\n/,
        repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/)),
        kw("LOOP"), choice(kw("WHILE"), kw("UNTIL")), $.expression, /\r?\n/),
      seq(kw("DO"), /\r?\n/,
        repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/)),
        kw("LOOP"), /\r?\n/),
    ),

    // --- EXIT ---
    exit_statement: $ => seq(kw("EXIT"), choice(kw("FOR"), kw("DO"), kw("SUB"), kw("FUNCTION"))),

    // --- SUB/FUNCTION definitions (peer of line) ---
    declare_statement: $ => seq(
      kw("DECLARE"),
      choice(kw("SUB"), kw("FUNCTION")),
      $.identifier,
      optional($.parameter_list)
    ),
    sub_definition: $ => seq(
      kw("SUB"), field("name", $.identifier),
      optional(kw("STATIC")),
      optional($.parameter_list), /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/)),
      kw("END"), kw("SUB"), /\r?\n/
    ),
    function_definition: $ => seq(
      kw("FUNCTION"), field("name", $.identifier),
      optional($.type_sigil),
      optional(kw("STATIC")),
      optional($.parameter_list), /\r?\n/,
      repeat(choice($.line, $.block_if_statement, $.select_case_statement, $.do_statement, /\r?\n/)),
      kw("END"), kw("FUNCTION"), /\r?\n/
    ),
    parameter_list: $ => seq("(", commaSep($.parameter), ")"),
    parameter: $ => seq($.identifier, optional($.type_sigil)),
    call_statement: $ => seq(kw("CALL"), $.identifier, optional(seq("(", commaSep($.expression), ")"))),

    // --- TYPE definition (peer of line) ---
    type_definition: $ => seq(
      kw("TYPE"), field("name", $.identifier), /\r?\n/,
      repeat($.type_member),
      kw("END"), kw("TYPE"), /\r?\n/
    ),
    type_member: $ => seq($.identifier, kw("AS"), $.type_name, /\r?\n/),
    type_name: $ => choice(
      kw("INTEGER"), kw("LONG"), kw("SINGLE"), kw("DOUBLE"), kw("STRING"),
      seq(kw("STRING"), "*", $.expression),
      $.identifier
    ),
    member_access: $ => seq($.identifier, ".", $.identifier),

    // --- Variable scoping ---
    const_statement: $ => seq(kw("CONST"), commaSep1(seq($.identifier, "=", $.expression))),
    shared_statement: $ => seq(kw("SHARED"), commaSep1($.variable)),
    static_statement: $ => seq(kw("STATIC"), commaSep1($.variable)),

    // QBasic DIM supports both array dimensions and AS type:
    //   DIM A(10)       — array
    //   DIM x AS INTEGER — typed variable
    //   DIM SHARED x AS INTEGER
    dim_statement: $ => seq(kw("DIM"), optional(kw("SHARED")), commaSep1($.dim_variable)),
    dim_variable: $ => choice(
      seq($.identifier, optional($.type_sigil), "(", commaSep1($.expression), ")"),
      seq($.identifier, kw("AS"), $.type_name),
    ),

    // --- All GW-BASIC statements (QBasic is a superset) ---
    // File I/O
    open_statement: $ => seq(
      kw("OPEN"), $.expression,
      optional(seq(kw("FOR"), choice(kw("INPUT"), kw("OUTPUT"), kw("APPEND"), kw("RANDOM"), kw("BINARY")))),
      kw("AS"), optional("#"), $.expression,
      optional(seq(kw("LEN"), "=", $.expression))
    ),
    close_statement: $ => seq(kw("CLOSE"), optional(seq(optional("#"), commaSep1($.expression)))),
    get_statement: $ => seq(kw("GET"), optional("#"), $.expression, optional(seq(",", $.expression))),
    put_statement: $ => seq(kw("PUT"), optional("#"), $.expression, optional(seq(",", $.expression))),
    print_file_statement: $ => seq(kw("PRINT"), "#", $.expression, ",", optional($.print_list)),
    input_file_statement: $ => seq(kw("INPUT"), "#", $.expression, ",", commaSep1($.variable)),
    line_input_file_statement: $ => seq(kw("LINE"), kw("INPUT"), "#", $.expression, ",", $.variable),
    write_file_statement: $ => seq(kw("WRITE"), "#", $.expression, optional(seq(",", commaSep($.expression)))),
    field_statement: $ => seq(kw("FIELD"), optional("#"), $.expression, ",", commaSep1(seq($.expression, kw("AS"), $.variable))),
    lset_statement: $ => seq(kw("LSET"), $.variable, "=", $.expression),
    rset_statement: $ => seq(kw("RSET"), $.variable, "=", $.expression),
    // Graphics
    screen_statement: $ => seq(kw("SCREEN"), commaSep1($.expression)),
    line_graph_statement: $ => seq(
      kw("LINE"),
      optional(seq("(", $.expression, ",", $.expression, ")")),
      "-", "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression)),
      optional(seq(",", choice(token(kw("B")), token(kw("BF")))))
    ),
    circle_statement: $ => seq(
      kw("CIRCLE"), "(", $.expression, ",", $.expression, ")",
      ",", $.expression,
      optional(seq(",", $.expression,
        optional(seq(",", $.expression,
          optional(seq(",", $.expression))))))
    ),
    draw_statement: $ => seq(kw("DRAW"), $.expression),
    paint_statement: $ => seq(
      kw("PAINT"), "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression, optional(seq(",", $.expression))))
    ),
    pset_statement: $ => seq(
      choice(kw("PSET"), kw("PRESET")),
      "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression))
    ),
    color_statement: $ => seq(kw("COLOR"), commaSep1($.expression)),
    palette_statement: $ => seq(kw("PALETTE"), optional(seq($.expression, ",", $.expression))),
    view_statement: $ => seq(
      kw("VIEW"), optional(kw("PRINT")),
      optional(seq("(", $.expression, ",", $.expression, ")",
        "-", "(", $.expression, ",", $.expression, ")"))
    ),
    window_statement: $ => seq(
      kw("WINDOW"),
      optional(seq("(", $.expression, ",", $.expression, ")",
        "-", "(", $.expression, ",", $.expression, ")"))
    ),
    pcopy_statement: $ => seq(kw("PCOPY"), $.expression, ",", $.expression),
    // Sound
    play_statement: $ => seq(kw("PLAY"), $.expression),
    sound_statement: $ => seq(kw("SOUND"), $.expression, ",", $.expression),
    beep_statement: $ => kw("BEEP"),
    // Screen/keyboard
    key_statement: $ => seq(kw("KEY"), choice(
      seq($.expression, ",", $.expression),
      kw("ON"), kw("OFF"), kw("LIST")
    )),
    locate_statement: $ => seq(kw("LOCATE"), commaSep($.expression)),
    cls_statement: $ => seq(kw("CLS"), optional($.expression)),
    width_statement: $ => seq(kw("WIDTH"), commaSep1($.expression)),
    // Memory
    def_seg_statement: $ => seq(kw("DEF"), kw("SEG"), optional(seq("=", $.expression))),
    bload_statement: $ => seq(kw("BLOAD"), $.expression, optional(seq(",", $.expression))),
    bsave_statement: $ => seq(kw("BSAVE"), $.expression, ",", $.expression, ",", $.expression),
    // Error handling — QBasic targets can be labels too
    on_error_statement: $ => seq(kw("ON"), kw("ERROR"), kw("GOTO"), choice($.line_number, $.identifier)),
    resume_statement: $ => seq(kw("RESUME"), optional(choice(kw("NEXT"), $.line_number, $.identifier))),
    // Program chaining
    chain_statement: $ => seq(kw("CHAIN"), optional(kw("MERGE")), $.expression, optional(seq(",", $.expression))),
    common_var_statement: $ => seq(kw("COMMON"), commaSep1($.variable)),
    // Event trapping
    on_timer_statement: $ => seq(kw("ON"), kw("TIMER"), "(", $.expression, ")", kw("GOSUB"), choice($.line_number, $.identifier)),
    on_key_statement: $ => seq(kw("ON"), kw("KEY"), "(", $.expression, ")", kw("GOSUB"), choice($.line_number, $.identifier)),
    timer_control_statement: $ => seq(kw("TIMER"), choice(kw("ON"), kw("OFF"), kw("STOP"))),
    key_control_statement: $ => seq(kw("KEY"), "(", $.expression, ")", choice(kw("ON"), kw("OFF"), kw("STOP"))),
    // MS BASIC extras
    clear_statement: $ => seq(kw("CLEAR"), optional(seq(",", $.expression, optional(seq(",", $.expression))))),
    run_statement: $ => seq(kw("RUN"), optional(choice($.line_number, $.string_literal))),

    // QBasic GOTO/GOSUB accept labels
    goto_statement: $ => seq(kw("GOTO"), choice($.line_number, $.identifier)),
    gosub_statement: $ => seq(kw("GOSUB"), choice($.line_number, $.identifier)),

    statement: $ => choice(
      ...common.statementChoices.map(fn => fn($)),
      // QBasic-specific
      $.exit_statement,
      $.declare_statement,
      $.call_statement,
      $.const_statement,
      $.shared_statement,
      $.static_statement,
      // All GW-BASIC statements
      $.open_statement, $.close_statement, $.get_statement, $.put_statement,
      $.print_file_statement, $.input_file_statement, $.line_input_file_statement,
      $.write_file_statement, $.field_statement, $.lset_statement, $.rset_statement,
      $.screen_statement, $.line_graph_statement, $.circle_statement,
      $.draw_statement, $.paint_statement, $.pset_statement,
      $.color_statement, $.palette_statement, $.view_statement, $.window_statement,
      $.pcopy_statement,
      $.play_statement, $.sound_statement, $.beep_statement,
      $.key_statement, $.locate_statement, $.cls_statement, $.width_statement,
      $.def_seg_statement, $.bload_statement, $.bsave_statement,
      $.on_error_statement, $.resume_statement,
      $.chain_statement, $.common_var_statement,
      $.on_timer_statement, $.on_key_statement,
      $.timer_control_statement, $.key_control_statement,
      $.clear_statement, $.run_statement,
    ),

    primary_expression: $ => prec(14, choice(
      ...common.primaryChoices.map(fn => fn($)),
      $.member_access,
    )),
  },
});
```

- [ ] **Step 2: Create tree-sitter.json**

```json
{
  "name": "qbasic",
  "version": "0.1.0",
  "scope": "source.qbasic",
  "file-types": ["bas", "bi", "bm"],
  "injection-regex": "qbasic"
}
```

- [ ] **Step 3: Write procedures.txt**

```
================
SUB definition
================
SUB PrintMsg (msg$)
PRINT msg$
END SUB

---

(program
  (sub_definition
    name: (identifier)
    (parameter_list
      (parameter (identifier) (type_sigil)))
    (line
      (statement_list
        (print_statement
          (print_list
            (print_item (variable (identifier) (type_sigil)))))))))

================
FUNCTION definition
================
FUNCTION Square% (n%)
Square% = n% * n%
END FUNCTION

---

(program
  (function_definition
    name: (identifier)
    (type_sigil)
    (parameter_list
      (parameter (identifier) (type_sigil)))
    (line
      (statement_list
        (let_statement
          (variable (identifier) (type_sigil))
          (binary_expression
            (variable (identifier) (type_sigil))
            (variable (identifier) (type_sigil))))))))

================
SUB with STATIC
================
SUB Counter STATIC
x = x + 1
PRINT x
END SUB

---

(program
  (sub_definition
    name: (identifier)
    (line (statement_list (let_statement (variable (identifier)) (binary_expression (variable (identifier)) (literal (integer_literal))))))
    (line (statement_list (print_statement (print_list (print_item (variable (identifier)))))))))
```

- [ ] **Step 4: Write block_control_flow.txt**

```
================
Block IF ELSEIF ELSE
================
IF X > 0 THEN
PRINT "POSITIVE"
ELSEIF X = 0 THEN
PRINT "ZERO"
ELSE
PRINT "NEGATIVE"
END IF

---

(program
  (block_if_statement
    (binary_expression (variable (identifier)) (literal (integer_literal)))
    (line (statement_list (print_statement (print_list (print_item (literal (string_literal)))))))
    (elseif_clause
      (binary_expression (variable (identifier)) (literal (integer_literal)))
      (line (statement_list (print_statement (print_list (print_item (literal (string_literal))))))))
    (else_clause
      (line (statement_list (print_statement (print_list (print_item (literal (string_literal))))))))))

================
DO WHILE LOOP
================
DO WHILE X < 10
X = X + 1
LOOP

---

(program
  (do_statement
    (binary_expression (variable (identifier)) (literal (integer_literal)))
    (line (statement_list (let_statement (variable (identifier)) (binary_expression (variable (identifier)) (literal (integer_literal))))))))

================
SELECT CASE
================
SELECT CASE X
CASE 1
PRINT "ONE"
CASE ELSE
PRINT "OTHER"
END SELECT

---

(program
  (select_case_statement
    (variable (identifier))
    (case_clause
      (case_specifier_list (case_specifier (literal (integer_literal))))
      (line (statement_list (print_statement (print_list (print_item (literal (string_literal))))))))
    (case_else_clause
      (line (statement_list (print_statement (print_list (print_item (literal (string_literal))))))))))

================
Labels and GOTO
================
Start:
PRINT "HELLO"
GOTO Start

---

(program
  (line
    (label (identifier))
    (statement_list
      (print_statement (print_list (print_item (literal (string_literal)))))))
  (line
    (statement_list
      (goto_statement (identifier)))))
```

- [ ] **Step 5: Write types.txt**

```
================
TYPE definition
================
TYPE Point
X AS INTEGER
Y AS INTEGER
END TYPE

---

(program
  (type_definition
    name: (identifier)
    (type_member (identifier) (type_name))
    (type_member (identifier) (type_name))))

================
DIM AS type
================
DIM p AS Point

---

(program
  (line
    (statement_list
      (dim_statement
        (dim_variable (identifier) (type_name))))))

================
CONST
================
CONST PI = 3.14

---

(program
  (line
    (statement_list
      (const_statement (identifier) (literal (float_literal))))))
```

- [ ] **Step 6: Write error_recovery.txt, expressions.txt, statements.txt**

Similar pattern to other dialects. `expressions.txt` should test without line numbers. `error_recovery.txt` should test that valid code after errors still parses.

- [ ] **Step 7: Generate parser and run tests**

```bash
cd grammars/qbasic && tree-sitter generate && tree-sitter test
```

Use `tree-sitter parse` on samples to discover actual tree shapes. Update test S-expressions. Iterate until all tests pass.

- [ ] **Step 8: Create highlights.scm**

```scheme
(line_number) @constant.numeric
(integer_literal) @constant.numeric
(float_literal) @constant.numeric
(hex_literal) @constant.numeric
(octal_literal) @constant.numeric
(string_literal) @string
(comment) @comment
(apostrophe_comment) @comment
(identifier) @variable
(type_sigil) @punctuation.special
(builtin_function) @function.builtin
(user_function) @function
(label) @label
(sub_definition name: (identifier) @function.definition)
(function_definition name: (identifier) @function.definition)
(type_definition name: (identifier) @type.definition)
(type_name) @type
(parameter) @variable.parameter
```

- [ ] **Step 9: Create Rust crate files**

Same pattern as msbasic2/gwbasic. Change `msbasic2` → `qbasic` in:
- `crates/tree-sitter-qbasic/Cargo.toml`
- `crates/tree-sitter-qbasic/build.rs`
- `crates/tree-sitter-qbasic/src/lib.rs`

In `lib.rs`, use a QBasic-specific parse test:

```rust
#[test]
fn test_parse_sub_definition() {
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&super::LANGUAGE.into())
        .expect("Error loading qbasic parser");
    let source = "SUB Hello\nPRINT \"Hello\"\nEND SUB\n";
    let tree = parser.parse(source, None).expect("Failed to parse");
    let root = tree.root_node();
    assert_eq!(root.kind(), "program");
    assert!(!root.has_error());
}
```

- [ ] **Step 10: Create example program**

`examples/qbasic/hello.bas`:
```basic
DECLARE SUB PrintStars (n%)

CONST TITLE$ = "QBASIC DEMO"
PRINT TITLE$

TYPE Point
  X AS INTEGER
  Y AS INTEGER
END TYPE

DIM p AS Point
p.X = 10
p.Y = 20

FOR I% = 1 TO 5
  CALL PrintStars(I%)
NEXT I%

SELECT CASE p.X
CASE IS < 0
  PRINT "NEGATIVE"
CASE 0 TO 10
  PRINT "SMALL"
CASE ELSE
  PRINT "BIG"
END SELECT

END

SUB PrintStars (n%)
  DIM s AS STRING
  s = ""
  DO WHILE LEN(s) < n%
    s = s + "*"
  LOOP
  PRINT s
END SUB
```

- [ ] **Step 11: Build and test Rust crate**

```bash
cargo build -p tree-sitter-qbasic && cargo test -p tree-sitter-qbasic
```

- [ ] **Step 12: Commit**

```bash
git add grammars/qbasic crates/tree-sitter-qbasic examples/qbasic
git commit -m "feat: add QBasic grammar, tests, and Rust crate"
```

---

### Task 6: Full Build Validation and CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run full generate + test cycle**

```bash
make all
```

Expected: all three grammars generate and all tree-sitter + Rust tests pass.

- [ ] **Step 2: Run cargo clippy**

```bash
cargo clippy --workspace
```

Fix any warnings.

- [ ] **Step 3: Benchmark parser sizes**

```bash
wc -l grammars/*/src/parser.c
```

If any parser exceeds ~200k lines, investigate switching case-insensitive keywords to an external scanner.

- [ ] **Step 4: Update CLAUDE.md**

Update to reflect the multi-grammar workspace architecture, build commands, and development workflow.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for multi-grammar workspace"
```

- [ ] **Step 6: Clean build verification**

```bash
make clean && make all
```

Expected: clean build from scratch passes.
