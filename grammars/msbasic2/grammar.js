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

  conflicts: $ => [
    [$.statement_list],
    [$.if_statement],
  ],

  rules: {
    // program MUST be first — tree-sitter uses the first rule as the start symbol
    program: $ => repeat(choice($.line, /\r?\n/)),

    ...common.rules,

    // Override integer_literal with lower token precedence to avoid
    // conflicting with line_number (which has prec(1))
    integer_literal: $ => token(prec(-1, /\d+/)),

    // Override identifier with lower token precedence so keywords win
    identifier: $ => token(prec(-2, /[a-zA-Z][a-zA-Z0-9]*/)),

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
