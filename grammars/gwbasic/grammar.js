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

    // GW-BASIC: line numbers REQUIRED
    line: $ => seq($.line_number, $.statement_list, /\r?\n/),

    // Override statement_list to allow apostrophe comments without colon separator
    // In GW-BASIC, ' acts like :REM so it can follow a statement without ':'
    statement_list: $ => seq(
      $.statement,
      repeat(seq(":", $.statement)),
      optional($.apostrophe_comment),
    ),

    // ====== File I/O ======
    open_statement: $ => seq(
      kw("OPEN"),
      $.expression,
      optional(seq(
        kw("FOR"),
        choice(kw("INPUT"), kw("OUTPUT"), kw("APPEND"), kw("RANDOM")),
      )),
      optional(seq(kw("ACCESS"), choice(kw("READ"), kw("WRITE"), seq(kw("READ"), kw("WRITE"))))),
      kw("AS"),
      optional("#"),
      $.expression,
      optional(seq(kw("LEN"), "=", $.expression)),
    ),
    close_statement: $ => seq(kw("CLOSE"), optional(seq(optional("#"), $.expression))),
    get_statement: $ => seq(kw("GET"), optional("#"), $.expression, optional(seq(",", $.expression))),
    put_statement: $ => seq(kw("PUT"), optional("#"), $.expression, optional(seq(",", $.expression))),
    print_file_statement: $ => seq(
      kw("PRINT"), "#", $.expression, ",",
      optional($.print_list),
    ),
    input_file_statement: $ => seq(
      kw("INPUT"), "#", $.expression, ",",
      commaSep1($.variable),
    ),
    line_input_file_statement: $ => seq(
      kw("LINE"), kw("INPUT"), "#", $.expression, ",",
      $.variable,
    ),
    write_file_statement: $ => seq(
      kw("WRITE"), "#", $.expression, ",",
      optional(commaSep1($.expression)),
    ),
    field_statement: $ => seq(
      kw("FIELD"), optional("#"), $.expression, ",",
      commaSep1(seq($.expression, kw("AS"), $.variable)),
    ),
    lset_statement: $ => seq(kw("LSET"), $.variable, "=", $.expression),
    rset_statement: $ => seq(kw("RSET"), $.variable, "=", $.expression),

    // ====== Graphics ======
    screen_statement: $ => seq(kw("SCREEN"), commaSep1($.expression)),
    color_statement: $ => seq(kw("COLOR"), commaSep1($.expression)),
    pset_statement: $ => seq(
      choice(kw("PSET"), kw("PRESET")),
      "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression)),
    ),
    line_graph_statement: $ => seq(
      kw("LINE"),
      optional(seq("(", $.expression, ",", $.expression, ")")),
      "-",
      "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression)),
      optional(seq(",", choice(kw("B"), kw("BF")))),
    ),
    circle_statement: $ => seq(
      kw("CIRCLE"),
      "(", $.expression, ",", $.expression, ")",
      ",", $.expression,
      optional(seq(",", optional($.expression))),
      optional(seq(",", optional($.expression))),
      optional(seq(",", optional($.expression))),
      optional(seq(",", optional($.expression))),
    ),
    draw_statement: $ => seq(kw("DRAW"), $.expression),
    paint_statement: $ => seq(
      kw("PAINT"),
      "(", $.expression, ",", $.expression, ")",
      optional(seq(",", $.expression)),
      optional(seq(",", $.expression)),
    ),
    view_statement: $ => seq(
      kw("VIEW"),
      optional(kw("SCREEN")),
      optional(seq(
        "(", $.expression, ",", $.expression, ")",
        "-",
        "(", $.expression, ",", $.expression, ")",
        optional(seq(",", $.expression)),
        optional(seq(",", $.expression)),
      )),
    ),
    window_statement: $ => seq(
      kw("WINDOW"),
      optional(kw("SCREEN")),
      optional(seq(
        "(", $.expression, ",", $.expression, ")",
        "-",
        "(", $.expression, ",", $.expression, ")",
      )),
    ),
    pcopy_statement: $ => seq(kw("PCOPY"), $.expression, ",", $.expression),
    palette_statement: $ => seq(kw("PALETTE"), optional(seq($.expression, ",", $.expression))),

    // ====== Sound ======
    play_statement: $ => seq(kw("PLAY"), $.expression),
    sound_statement: $ => seq(kw("SOUND"), $.expression, ",", $.expression),
    beep_statement: $ => kw("BEEP"),

    // ====== Screen/Keyboard ======
    key_statement: $ => seq(kw("KEY"), $.expression, optional(seq(",", $.expression))),
    locate_statement: $ => seq(kw("LOCATE"), commaSep1(optional($.expression))),
    cls_statement: $ => seq(kw("CLS"), optional($.expression)),
    width_statement: $ => seq(kw("WIDTH"), commaSep1($.expression)),

    // ====== Memory ======
    def_seg_statement: $ => seq(kw("DEF"), kw("SEG"), optional(seq("=", $.expression))),
    bload_statement: $ => seq(kw("BLOAD"), $.expression, optional(seq(",", $.expression))),
    bsave_statement: $ => seq(kw("BSAVE"), $.expression, ",", $.expression, ",", $.expression),

    // ====== Error handling ======
    on_error_statement: $ => seq(kw("ON"), kw("ERROR"), kw("GOTO"), $.line_number),
    resume_statement: $ => seq(kw("RESUME"), optional(choice(kw("NEXT"), $.line_number))),

    // ====== Program chaining ======
    chain_statement: $ => seq(kw("CHAIN"), optional(kw("MERGE")), $.expression, optional(seq(",", $.expression))),
    common_var_statement: $ => seq(kw("COMMON"), commaSep1($.variable)),

    // ====== Event trapping ======
    on_timer_statement: $ => seq(kw("ON"), kw("TIMER"), "(", $.expression, ")", kw("GOSUB"), $.line_number),
    on_key_statement: $ => seq(kw("ON"), kw("KEY"), "(", $.expression, ")", kw("GOSUB"), $.line_number),
    timer_control_statement: $ => seq(kw("TIMER"), choice(kw("ON"), kw("OFF"), kw("STOP"))),
    key_control_statement: $ => seq(kw("KEY"), "(", $.expression, ")", choice(kw("ON"), kw("OFF"), kw("STOP"))),

    // ====== MS BASIC 2.0 extras ======
    clear_statement: $ => seq(kw("CLEAR"), optional($.expression)),
    cont_statement: $ => kw("CONT"),
    list_statement: $ => seq(kw("LIST"), optional(seq(
      optional($.line_number), optional(seq("-", optional($.line_number)))
    ))),
    run_statement: $ => seq(kw("RUN"), optional($.line_number)),
    usr_call: $ => seq(kw("USR"), "(", $.expression, ")"),
    write_statement: $ => seq(kw("WRITE"), optional(commaSep1($.expression))),

    // ====== Statement choice ======
    statement: $ => choice(
      ...common.statementChoices.map(fn => fn($)),
      // File I/O
      $.open_statement,
      $.close_statement,
      $.get_statement,
      $.put_statement,
      $.print_file_statement,
      $.input_file_statement,
      $.line_input_file_statement,
      $.write_file_statement,
      $.field_statement,
      $.lset_statement,
      $.rset_statement,
      // Graphics
      $.screen_statement,
      $.color_statement,
      $.pset_statement,
      $.line_graph_statement,
      $.circle_statement,
      $.draw_statement,
      $.paint_statement,
      $.view_statement,
      $.window_statement,
      $.pcopy_statement,
      $.palette_statement,
      // Sound
      $.play_statement,
      $.sound_statement,
      $.beep_statement,
      // Screen/Keyboard
      $.key_statement,
      $.locate_statement,
      $.cls_statement,
      $.width_statement,
      // Memory
      $.def_seg_statement,
      $.bload_statement,
      $.bsave_statement,
      // Error handling
      $.on_error_statement,
      $.resume_statement,
      // Program chaining
      $.chain_statement,
      $.common_var_statement,
      // Event trapping
      $.on_timer_statement,
      $.on_key_statement,
      $.timer_control_statement,
      $.key_control_statement,
      // MS BASIC 2.0 extras
      $.clear_statement,
      $.cont_statement,
      $.list_statement,
      $.run_statement,
      $.write_statement,
    ),

    // Override system_variable to include GW-BASIC system variables
    system_variable: $ => choice(
      token(kw("INKEY$")),
      token(kw("TIMER")),
      token(kw("ERR")),
      token(kw("ERL")),
      token(kw("CSRLIN")),
    ),

    primary_expression: $ => prec(14, choice(
      ...common.primaryChoices.map(fn => fn($)),
      $.usr_call,
    )),
  },
});
