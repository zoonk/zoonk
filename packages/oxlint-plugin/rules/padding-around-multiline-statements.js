import { defineRule } from "@oxlint/plugins";

const MODULE_BOUNDARY_STATEMENTS = new Set([
  "ExportAllDeclaration",
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
  "ImportDeclaration",
  "TSExportAssignment",
  "TSImportEqualsDeclaration",
  "TSNamespaceExportDeclaration",
]);

/** oxfmt already formats the spacing of imports and exports. */
function isModuleBoundaryStatement(statement) {
  return MODULE_BOUNDARY_STATEMENTS.has(statement.type);
}

function isMultilineStatement(statement) {
  return statement.loc.start.line !== statement.loc.end.line;
}

function hasUsableRange(statement) {
  return Array.isArray(statement.range) && statement.range.length === 2;
}

/** A comment in the gap may belong to either statement, so the fix can't place the blank line. */
function isPlainWhitespaceGap({ sourceText, previousStatement, nextStatement }) {
  const gap = sourceText.slice(previousStatement.range[1], nextStatement.range[0]);

  return /^\s*$/u.test(gap);
}

function hasBlankLineBetween({ previousStatement, nextStatement }) {
  return nextStatement.loc.start.line > previousStatement.loc.end.line + 1;
}

function getStatementIndentation({ sourceText, statement }) {
  const lineStart = sourceText.lastIndexOf("\n", statement.range[0] - 1) + 1;
  const linePrefix = sourceText.slice(lineStart, statement.range[0]);

  return linePrefix.match(/^\s*/u)[0];
}

function shouldCheckStatementPair({ sourceText, previousStatement, nextStatement }) {
  if (!hasUsableRange(previousStatement) || !hasUsableRange(nextStatement)) {
    return false;
  }

  if (isModuleBoundaryStatement(previousStatement) || isModuleBoundaryStatement(nextStatement)) {
    return false;
  }

  if (!isMultilineStatement(previousStatement) && !isMultilineStatement(nextStatement)) {
    return false;
  }

  if (hasBlankLineBetween({ previousStatement, nextStatement })) {
    return false;
  }

  return isPlainWhitespaceGap({ sourceText, previousStatement, nextStatement });
}

function getReplacementGap({ sourceText, previousStatement, nextStatement }) {
  const gap = sourceText.slice(previousStatement.range[1], nextStatement.range[0]);
  const newline = gap.includes("\r\n") ? "\r\n" : "\n";
  const indentation = getStatementIndentation({ sourceText, statement: nextStatement });

  return `${newline}${newline}${indentation}`;
}

function reportMissingBlankLine({ context, sourceText, previousStatement, nextStatement }) {
  context.report({
    loc: nextStatement.loc,
    messageId: "missingBlankLine",
    fix(fixer) {
      return fixer.replaceTextRange(
        [previousStatement.range[1], nextStatement.range[0]],
        getReplacementGap({ sourceText, previousStatement, nextStatement }),
      );
    },
  });
}

function checkStatementList({ context, sourceText, statements }) {
  for (const [index, nextStatement] of statements.entries()) {
    const previousStatement = statements[index - 1];

    const shouldReport =
      previousStatement &&
      shouldCheckStatementPair({ sourceText, previousStatement, nextStatement });

    if (shouldReport) {
      reportMissingBlankLine({ context, sourceText, previousStatement, nextStatement });
    }
  }
}

export default defineRule({
  create(context) {
    const sourceText = context.sourceCode.getText();

    return {
      BlockStatement(node) {
        checkStatementList({ context, sourceText, statements: node.body });
      },

      Program(node) {
        checkStatementList({ context, sourceText, statements: node.body });
      },

      StaticBlock(node) {
        checkStatementList({ context, sourceText, statements: node.body });
      },

      SwitchCase(node) {
        checkStatementList({ context, sourceText, statements: node.consequent });
      },
    };
  },

  meta: {
    docs: {
      description:
        "Require blank lines around multiline statements while leaving imports, exports, and commented gaps untouched",
    },
    fixable: "whitespace",
    messages: { missingBlankLine: "Add a blank line around this multiline statement." },
    schema: [],
    type: "layout",
  },
});
