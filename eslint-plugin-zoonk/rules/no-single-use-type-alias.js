function getRemovalRange(sourceCode, aliasNode) {
  const tokenBefore = sourceCode.getTokenBefore(aliasNode);
  const tokenAfter = sourceCode.getTokenAfter(aliasNode);
  let rangeStart = aliasNode.range[0];
  let rangeEnd = aliasNode.range[1];

  if (tokenAfter && tokenAfter.type === "Punctuator" && tokenAfter.value === ";") {
    rangeEnd = tokenAfter.range[1];
  }

  const textAfter = sourceCode.getText().slice(rangeEnd);
  const newlinesAfter = textAfter.match(/^[\r\n]+/);

  if (newlinesAfter) {
    rangeEnd += newlinesAfter[0].length;
  }

  if (tokenBefore && aliasNode.range[0] - tokenBefore.range[1] > 0) {
    const textBetween = sourceCode.getText().slice(tokenBefore.range[1], aliasNode.range[0]);

    if (/^[\s]*$/.test(textBetween)) {
      rangeStart = tokenBefore.range[1];
      const leadingNewlines = textBetween.match(/^[\r\n]+/);

      if (leadingNewlines) {
        rangeStart += leadingNewlines[0].length;
      }
    }
  }

  return [rangeStart, rangeEnd];
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  create(context) {
    const typeAliases = new Map();
    const typeReferences = new Map();
    const exportedIdentifiers = new Set();

    return {
      ExportNamedDeclaration(node) {
        if (node.declaration && node.declaration.type === "TSTypeAliasDeclaration") {
          exportedIdentifiers.add(node.declaration.id.name);
        }

        if (node.specifiers) {
          for (const specifier of node.specifiers) {
            if (specifier.local) {
              exportedIdentifiers.add(specifier.local.name);
            }
          }
        }
      },

      "Program:exit"() {
        const sourceCode = context.sourceCode;

        for (const [name, aliasNode] of typeAliases) {
          const isExported = exportedIdentifiers.has(name);
          const references = typeReferences.get(name) || [];
          const isSingleUse = !isExported && references.length === 1;

          if (isSingleUse) {
            const referenceNode = references[0];
            const removalRange = getRemovalRange(sourceCode, aliasNode);
            const typeDefinition = sourceCode.getText(aliasNode.typeAnnotation);

            context.report({
              data: { name },
              fix(fixer) {
                return [
                  fixer.replaceText(referenceNode, typeDefinition),
                  fixer.removeRange(removalRange),
                ];
              },
              messageId: "singleUse",
              node: aliasNode,
            });
          }
        }
      },

      TSTypeAliasDeclaration(node) {
        typeAliases.set(node.id.name, node);
      },

      TSTypeReference(node) {
        if (node.typeName && node.typeName.type === "Identifier") {
          const name = node.typeName.name;

          if (!typeReferences.has(name)) {
            typeReferences.set(name, []);
          }

          typeReferences.get(name).push(node);
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Disallow non-exported type aliases that are used only once - inline them instead",
    },
    fixable: "code",
    messages: {
      singleUse: "Type alias '{{name}}' is only used once and is not exported. Inline it instead.",
    },
    schema: [],
    type: "suggestion",
  },
};
