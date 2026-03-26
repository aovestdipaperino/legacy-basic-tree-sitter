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

publish-prep:
	@for d in $(DIALECTS); do \
		mkdir -p crates/tree-sitter-$$d/grammar-src && \
		cp -r grammars/$$d/src/* crates/tree-sitter-$$d/grammar-src/ && \
		cp -r grammars/$$d/queries crates/tree-sitter-$$d/; \
	done
	@echo "Run 'cargo publish -p tree-sitter-<dialect>' from crate dir after this"
