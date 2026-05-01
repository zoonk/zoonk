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

/**
 * Module imports and exports already have dedicated formatting in oxfmt, so this
 * rule should stay focused on local statement flow inside executable code.
 */
function isModuleBoundaryStatement(statement) {
  return MODULE_BOUNDARY_STATEMENTS.has(statement.type);
}

/**
 * Multiline statements carry enough visual weight that adjacent statements need
 * a blank line to make each step in the block scannable.
 */
function isMultilineStatement(statement) {
  return statement.loc.start.line !== statement.loc.end.line;
}

/**
 * Fixes need stable byte ranges so they can replace only the whitespace between
 * two statements without touching the statements themselves.
 */
function hasUsableRange(statement) {
  return Array.isArray(statement.range) && statement.range.length === 2;
}

/**
 * A pair with comments in the gap is skipped because a comment may belong to
 * either side, and automatic whitespace fixes should not guess that ownership.
 */
function isPlainWhitespaceGap({ sourceText, previousStatement, nextStatement }) {
  const gap = sourceText.slice(previousStatement.range[1], nextStatement.range[0]);

  return /^\s*$/.test(gap);
}

/**
 * Existing blank lines are valid; the rule only adds the missing separator and
 * never normalizes larger gaps to avoid creating noisy formatting churn.
 */
function hasBlankLineBetween({ previousStatement, nextStatement }) {
  return nextStatement.loc.start.line > previousStatement.loc.end.line + 1;
}

/**
 * Deriving indentation from the next statement's source line keeps the fixer
 * stable even if two statements somehow started on the same physical line.
 */
function getStatementIndentation({ sourceText, statement }) {
  const lineStart = sourceText.lastIndexOf("\n", statement.range[0] - 1) + 1;
  const linePrefix = sourceText.slice(lineStart, statement.range[0]);

  return linePrefix.match(/^\s*/)[0];
}

/**
 * Statement pairs are checked only when a multiline statement touches another
 * statement and the auto-fix can safely operate on plain whitespace.
 */
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

/**
 * The replacement keeps the next statement's existing indentation while adding
 * exactly one empty line between the two statements.
 */
function getReplacementGap({ sourceText, previousStatement, nextStatement }) {
  const gap = sourceText.slice(previousStatement.range[1], nextStatement.range[0]);
  const newline = gap.includes("\r\n") ? "\r\n" : "\n";
  const indentation = getStatementIndentation({ sourceText, statement: nextStatement });

  return `${newline}${newline}${indentation}`;
}

/**
 * Reporting against the next statement makes the diagnostic point at the code
 * that needs to move down, while the fix only changes the preceding whitespace.
 */
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

/**
 * Adjacent statements are the only relationships that matter for this rule; the
 * AST visitor supplies each statement list that can contain executable steps.
 */
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
