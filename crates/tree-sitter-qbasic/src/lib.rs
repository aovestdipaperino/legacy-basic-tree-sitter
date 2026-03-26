use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_qbasic() -> *const ();
}

/// Language function for QBasic.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_qbasic) };

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading qbasic parser");
    }

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
}
