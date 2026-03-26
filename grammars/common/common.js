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
  const rules = {
    // --- Literals ---
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
      $.float_literal,
      $.integer_literal,
      $.hex_literal,
      $.octal_literal,
      $.string_literal,
    ),

    // --- Variables ---
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
