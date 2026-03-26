use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_gwbasic() -> *const ();
}

/// Language function for GW-BASIC.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_gwbasic) };

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading gwbasic parser");
    }

    #[test]
    fn test_parse_hello_world() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading gwbasic parser");
        let tree = parser
            .parse("10 PRINT \"HELLO WORLD\"\n", None)
            .expect("Failed to parse");
        let root = tree.root_node();
        assert_eq!(root.kind(), "program");
        assert!(!root.has_error());
    }
}
