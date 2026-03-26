const { kw, commaSep, commaSep1, commonRules } = require("../common/common");

const common = commonRules({
  while_wend: true,
  swap: true,
  line_input: true,
  apostrophe_comment: true,
});

// Remove 'program' from common rules so our definition stays first
const { program: _discardProgram, ...commonRulesNoProgram } = common.rules;

// Helper: body inside block structures (lines + nested blocks + blank lines)
function blockBody($) {
  return repeat(choice(
    $.line,
    $.block_if_statement,
    $.select_case_statement,
    $.do_statement,
    /\r?\n/,
  ));
}

module.exports = grammar({
  name: "qbasic",

  extras: $ => [/[ \t]/],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.statement_list],
    [$.if_statement],
    [$.else_clause],
    [$.elseif_clause],
    [$.case_clause],
    [$.case_else_clause],
  ],

  rules: {
    // program MUST be first — tree-sitter uses the first rule as the start symbol.
    // Block statements are PEERS of line in program (not children).
    program: $ => repeat(choice(
      $.block_if_statement,
      $.select_case_statement,
      $.do_statement,
      $.sub_definition,
      $.function_definition,
      $.type_definition,
      $.line,
      /\r?\n/,
    )),

    // Spread common rules (minus program which we already defined above)
    ...commonRulesNoProgram,

    // Override integer_literal with lower token precedence to avoid
    // conflicting with line_number (which has prec(1))
    integer_literal: $ => token(prec(-1, /\d+/)),

    // Override identifier with lower token precedence so keywords win
    identifier: $ => token(prec(-2, /[a-zA-Z][a-zA-Z0-9]*/)),

    // Override variable to support member access (p.X, rec.field)
    variable: $ => seq(
      $.identifier,
      optional($.type_sigil),
      optional(choice(
        seq("(", commaSep1($.expression), ")"),
        seq(".", $.identifier),
      ))
    ),

    // QBasic: line numbers OPTIONAL, labels supported
    // Label-only lines are valid (no statement required after label)
    line: $ => choice(
      // Line with content (optional label/line_number + required statement_list)
      seq(optional(choice($.line_number, $.label)), $.statement_list, /\r?\n/),
      // Label-only line (no statement)
      seq(choice($.line_number, $.label), /\r?\n/),
    ),

    label: $ => seq($.identifier, ":"),

    // Override statement_list to allow apostrophe comments without colon separator
    statement_list: $ => seq(
      $.statement,
      repeat(seq(":", $.statement)),
      optional($.apostrophe_comment),
    ),

    // ====== Block IF/THEN/ELSEIF/ELSE/END IF ======
    block_if_statement: $ => seq(
      kw("IF"), $.expression, kw("THEN"), /\r?\n/,
      blockBody($),
      repeat($.elseif_clause),
      optional($.else_clause),
      kw("END"), kw("IF"), /\r?\n/,
    ),

    elseif_clause: $ => seq(
      kw("ELSEIF"), $.expression, kw("THEN"), /\r?\n/,
      blockBody($),
    ),

    else_clause: $ => seq(
      kw("ELSE"), /\r?\n/,
      blockBody($),
    ),

    // ====== SELECT CASE ======
    select_case_statement: $ => seq(
      kw("SELECT"), kw("CASE"), $.expression, /\r?\n/,
      repeat($.case_clause),
      optional($.case_else_clause),
      kw("END"), kw("SELECT"), /\r?\n/,
    ),

    case_clause: $ => seq(
      kw("CASE"), commaSep1($.case_specifier), /\r?\n/,
      blockBody($),
    ),

    case_else_clause: $ => seq(
      kw("CASE"), kw("ELSE"), /\r?\n/,
      blockBody($),
    ),

    case_specifier: $ => choice(
      seq(kw("IS"), choice("<", ">", "<=", ">=", "=", "<>"), $.expression),
      seq($.expression, kw("TO"), $.expression),
      $.expression,
    ),

    // ====== DO/LOOP ======
    do_statement: $ => choice(
      // DO WHILE/UNTIL ... LOOP
      seq(kw("DO"), choice(kw("WHILE"), kw("UNTIL")), $.expression, /\r?\n/,
        blockBody($),
        kw("LOOP"), /\r?\n/),
      // DO ... LOOP WHILE/UNTIL
      seq(kw("DO"), /\r?\n/,
        blockBody($),
        kw("LOOP"), choice(kw("WHILE"), kw("UNTIL")), $.expression, /\r?\n/),
      // DO ... LOOP (infinite)
      seq(kw("DO"), /\r?\n/,
        blockBody($),
        kw("LOOP"), /\r?\n/),
    ),

    // ====== SUB/FUNCTION definitions ======
    sub_definition: $ => seq(
      kw("SUB"), field("name", $.identifier), optional($.parameter_list), optional(kw("STATIC")), /\r?\n/,
      blockBody($),
      kw("END"), kw("SUB"), /\r?\n/,
    ),

    function_definition: $ => seq(
      kw("FUNCTION"), field("name", $.identifier), optional($.type_sigil), optional($.parameter_list), optional(kw("STATIC")), /\r?\n/,
      blockBody($),
      kw("END"), kw("FUNCTION"), /\r?\n/,
    ),

    parameter_list: $ => seq("(", commaSep1($.parameter), ")"),

    parameter: $ => seq($.identifier, optional($.type_sigil), optional(seq(kw("AS"), $.type_name))),

    type_name: $ => choice(
      kw("INTEGER"), kw("LONG"), kw("SINGLE"), kw("DOUBLE"), kw("STRING"),
      $.identifier,
    ),

    // ====== TYPE/END TYPE ======
    type_definition: $ => seq(
      kw("TYPE"), field("name", $.identifier), /\r?\n/,
      repeat($.type_member),
      kw("END"), kw("TYPE"), /\r?\n/,
    ),

    type_member: $ => seq(
      $.identifier, kw("AS"), $.type_name, /\r?\n/,
    ),

    // ====== File I/O (inherited from GW-BASIC) ======
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

    // ====== Error handling (QBasic: accepts labels too) ======
    on_error_statement: $ => seq(kw("ON"), kw("ERROR"), kw("GOTO"), choice($.line_number, $.identifier)),
    resume_statement: $ => seq(kw("RESUME"), optional(choice(kw("NEXT"), $.line_number, $.identifier))),

    // ====== Program chaining ======
    chain_statement: $ => seq(kw("CHAIN"), optional(kw("MERGE")), $.expression, optional(seq(",", $.expression))),
    common_var_statement: $ => seq(kw("COMMON"), optional(kw("SHARED")), commaSep1($.variable)),

    // ====== Event trapping (QBasic: accepts labels too) ======
    on_timer_statement: $ => seq(kw("ON"), kw("TIMER"), "(", $.expression, ")", kw("GOSUB"), choice($.line_number, $.identifier)),
    on_key_statement: $ => seq(kw("ON"), kw("KEY"), "(", $.expression, ")", kw("GOSUB"), choice($.line_number, $.identifier)),
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

    // ====== QBasic-specific statements ======
    // DIM with AS type (override common dim_statement)
    dim_statement: $ => seq(kw("DIM"), optional(kw("SHARED")), commaSep1($.dim_variable)),
    dim_variable: $ => choice(
      seq($.identifier, optional($.type_sigil), kw("AS"), $.type_name),
      seq($.identifier, optional($.type_sigil), "(", commaSep1($.expression), ")"),
    ),

    // CONST declaration
    const_statement: $ => seq(kw("CONST"), commaSep1(seq($.identifier, optional($.type_sigil), "=", $.expression))),

    // DECLARE SUB/FUNCTION
    declare_statement: $ => seq(
      kw("DECLARE"),
      choice(kw("SUB"), kw("FUNCTION")),
      $.identifier,
      optional($.parameter_list),
    ),

    // CALL statement
    call_statement: $ => seq(kw("CALL"), $.identifier, optional(seq("(", commaSep($.expression), ")"))),

    // STATIC statement (inside SUB/FUNCTION)
    static_statement: $ => seq(kw("STATIC"), commaSep1($.variable)),

    // SHARED statement (inside SUB/FUNCTION)
    shared_statement: $ => seq(kw("SHARED"), commaSep1($.variable)),

    // EXIT statement
    exit_statement: $ => seq(kw("EXIT"), choice(kw("FOR"), kw("DO"), kw("SUB"), kw("FUNCTION"))),

    // GOTO/GOSUB accept labels too (not just line numbers)
    goto_statement: $ => seq(kw("GOTO"), choice($.line_number, $.identifier)),
    gosub_statement: $ => seq(kw("GOSUB"), choice($.line_number, $.identifier)),

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
      // QBasic-specific
      $.const_statement,
      $.declare_statement,
      $.call_statement,
      $.static_statement,
      $.shared_statement,
      $.exit_statement,
    ),

    // Override system_variable to include QBasic system variables
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
