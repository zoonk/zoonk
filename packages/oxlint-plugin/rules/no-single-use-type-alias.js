import { defineRule } from "oxlint";

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

// Recursively expand type definition, replacing references to other single-use types
function expandTypeDefinition(sourceCode, aliasNode, violationMap, visited = new Set()) {
  const name = aliasNode.id.name;

  if (visited.has(name)) {
    return sourceCode.getText(aliasNode.typeAnnotation);
  }

  visited.add(name);

  let definition = sourceCode.getText(aliasNode.typeAnnotation);

  // Find and replace references to other single-use types within this definition
  for (const [otherName, otherViolation] of violationMap) {
    if (otherName !== name) {
      // Check if this type references the other type
      const otherRef = otherViolation.referenceNode;

      if (
        otherRef.range[0] >= aliasNode.typeAnnotation.range[0] &&
        otherRef.range[1] <= aliasNode.typeAnnotation.range[1]
      ) {
        // This definition contains a reference to another single-use type
        const otherDefinition = expandTypeDefinition(
          sourceCode,
          otherViolation.aliasNode,
          violationMap,
          visited,
        );
        const refStart = otherRef.range[0] - aliasNode.typeAnnotation.range[0];
        const refEnd = otherRef.range[1] - aliasNode.typeAnnotation.range[0];

        definition = definition.slice(0, refStart) + otherDefinition + definition.slice(refEnd);
      }
    }
  }

  return definition;
}

export default defineRule({
  createOnce(context) {
    let typeAliases;
    let typeReferences;
    let exportedIdentifiers;

    return {
      before() {
        typeAliases = new Map();
        typeReferences = new Map();
        exportedIdentifiers = new Set();
      },

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
        const violations = [];

        for (const [name, aliasNode] of typeAliases) {
          const isExported = exportedIdentifiers.has(name);
          const references = typeReferences.get(name) || [];
          const isSingleUse = !isExported && references.length === 1;

          if (isSingleUse) {
            const referenceNode = references[0];
            const removalRange = getRemovalRange(sourceCode, aliasNode);

            violations.push({
              aliasNode,
              name,
              referenceNode,
              removalRange,
            });
          }
        }

        if (violations.length === 0) {
          return;
        }

        // Build a map for quick lookup
        const violationMap = new Map(violations.map((vio) => [vio.name, vio]));

        // Find "leaf" violations - those whose references are NOT inside another violation's type definition
        // These are the ones we actually need to inline (the outer types)
        const leafViolations = violations.filter((violation) => {
          const refRange = violation.referenceNode.range;

          // Check if this reference is inside any other violation's type definition
          const isInsideAnotherType = violations.some((other) => {
            if (other === violation) {
              return false;
            }

            const otherTypeRange = other.aliasNode.typeAnnotation.range;

            return refRange[0] >= otherTypeRange[0] && refRange[1] <= otherTypeRange[1];
          });

          return !isInsideAnotherType;
        });

        if (leafViolations.length === 0) {
          return;
        }

        // Sort by position descending so fixes apply bottom-to-top
        leafViolations.sort((a, b) => b.aliasNode.range[0] - a.aliasNode.range[0]);

        // Single report with all fixes combined
        const names = violations.map((violation) => violation.name).join(", ");

        context.report({
          data: { name: names },
          fix(fixer) {
            const fixes = [];

            // For leaf violations, inline with expanded definitions
            for (const violation of leafViolations) {
              const expandedDefinition = expandTypeDefinition(
                sourceCode,
                violation.aliasNode,
                violationMap,
              );

              fixes.push(fixer.replaceText(violation.referenceNode, expandedDefinition));
            }

            // Remove all violation type declarations (sorted bottom-to-top)
            const sortedViolations = [...violations].toSorted(
              (a, b) => b.removalRange[0] - a.removalRange[0],
            );

            for (const violation of sortedViolations) {
              fixes.push(fixer.removeRange(violation.removalRange));
            }

            return fixes;
          },
          loc: leafViolations[0].aliasNode.loc,
          messageId: "singleUse",
        });
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
});
