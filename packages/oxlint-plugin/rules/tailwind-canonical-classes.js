import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineRule } from "@oxlint/plugins";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";

const CLASS_ATTRIBUTE_NAMES = new Set(["class", "className"]);
const CLASS_FUNCTION_NAMES = new Set(["clsx", "cn", "cva", "twMerge"]);
const STYLESHEET_URL = new URL("../../../packages/ui/src/styles/globals.css", import.meta.url);
const STYLESHEET_PATH = fileURLToPath(STYLESHEET_URL);

const designSystem = await loadDesignSystem();

/**
 * The Tailwind language server uses Tailwind's own design system to decide
 * which utility spelling is canonical. Loading the same stylesheet keeps this
 * lint rule aligned with the CSS entrypoint that defines Zoonk's theme tokens.
 */
async function loadDesignSystem() {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");

  return __unstable__loadDesignSystem(stylesheet, { base: dirname(STYLESHEET_PATH) });
}

/**
 * JSX namespaced attributes are not class attributes in this codebase. Keeping
 * the name check narrow avoids treating unrelated SVG or framework attributes
 * as Tailwind class lists.
 */
function isClassAttributeName(name) {
  return name.type === "JSXIdentifier" && CLASS_ATTRIBUTE_NAMES.has(name.name);
}

/**
 * The rule only inspects known class composition helpers because ordinary
 * function string arguments may be copy, IDs, URLs, or enum values rather than
 * Tailwind classes.
 */
function getClassFunctionName(callee) {
  if (callee.type === "Identifier") {
    return callee.name;
  }

  if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
    return callee.property.name;
  }

  return null;
}

/**
 * Dynamic template strings can contain partial utility names, so Tailwind cannot
 * safely canonicalize them as complete candidates. Static templates are handled
 * the same way as normal string literals.
 */
function getStaticStringExpression(expression) {
  if (expression.type === "Literal" && typeof expression.value === "string") {
    return expression;
  }

  if (expression.type === "TemplateLiteral" && expression.expressions.length === 0) {
    return expression;
  }

  return null;
}

/**
 * Replacement ranges are based on the raw source, not the decoded JS value, so
 * fixes preserve the surrounding quotes/backticks and only replace class tokens.
 */
function getStringContentRange({ node, sourceText }) {
  const text = sourceText.slice(node.range[0], node.range[1]);
  const quote = text[0];
  const closesWithSameQuote = text.at(-1) === quote;
  const isQuoted = quote === '"' || quote === "'" || quote === "`";
  const content = text.slice(1, -1);

  if (!isQuoted || !closesWithSameQuote || content.includes("\\")) {
    return null;
  }

  return { content, start: node.range[0] + 1 };
}

/**
 * Tailwind classes are whitespace-delimited in source files. Reporting each
 * token separately gives Oxlint a small, conflict-free fix range for `--fix`.
 */
function getClassTokens({ content, start }) {
  return Array.from(content.matchAll(/\S+/gu), (match) => ({
    end: start + match.index + match[0].length,
    start: start + match.index,
    value: match[0],
  }));
}

/**
 * Tailwind returns the original candidate when no better canonical spelling is
 * available. This helper isolates that API detail from the reporting logic.
 */
function getCanonicalClassName(className) {
  const [canonicalClassName] = designSystem.canonicalizeCandidates([className]);

  if (!canonicalClassName || canonicalClassName === className) {
    return null;
  }

  return canonicalClassName;
}

/**
 * Mapping byte offsets back to a source location makes diagnostics point at the
 * exact class token instead of the whole attribute or helper call.
 */
function getTokenLocation({ sourceCode, token }) {
  return {
    end: sourceCode.getLocFromIndex(token.end),
    start: sourceCode.getLocFromIndex(token.start),
  };
}

/**
 * Object values in class helpers may contain nested class strings, but condition
 * values like identifiers and booleans are not classes. This lets `clsx` object
 * keys still be linted without treating every property name as a class.
 */
function canContainClassString(expression) {
  if (expression.type === "Literal") {
    return typeof expression.value === "string";
  }

  return (
    expression.type === "ArrayExpression" ||
    expression.type === "ConditionalExpression" ||
    expression.type === "LogicalExpression" ||
    expression.type === "ObjectExpression" ||
    expression.type === "TemplateLiteral"
  );
}

/**
 * Static class strings are fixed token-by-token, which preserves existing class
 * ordering and whitespace while still applying Tailwind's canonical spellings.
 */
function reportClassString({ context, node, sourceText }) {
  const contentRange = getStringContentRange({ node, sourceText });

  if (!contentRange) {
    return;
  }

  const tokens = getClassTokens(contentRange);

  for (const token of tokens) {
    const canonicalClassName = getCanonicalClassName(token.value);

    if (canonicalClassName) {
      context.report({
        data: { actual: token.value, expected: canonicalClassName },
        loc: getTokenLocation({ sourceCode: context.sourceCode, token }),
        messageId: "useCanonicalClass",
        fix(fixer) {
          return fixer.replaceTextRange([token.start, token.end], canonicalClassName);
        },
      });
    }
  }
}

/**
 * Class helpers accept arrays, conditionals, and object values. Walking those
 * small expression containers lets the rule catch static classes without trying
 * to evaluate runtime conditions.
 */
function checkClassExpression({ context, expression, sourceText }) {
  const staticString = getStaticStringExpression(expression);

  if (staticString) {
    reportClassString({ context, node: staticString, sourceText });

    return;
  }

  if (expression.type === "ArrayExpression") {
    for (const element of expression.elements) {
      if (element) {
        checkClassExpression({ context, expression: element, sourceText });
      }
    }

    return;
  }

  if (expression.type === "ConditionalExpression") {
    checkClassExpression({ context, expression: expression.consequent, sourceText });
    checkClassExpression({ context, expression: expression.alternate, sourceText });

    return;
  }

  if (expression.type === "LogicalExpression") {
    checkClassExpression({ context, expression: expression.right, sourceText });

    return;
  }

  if (expression.type === "ObjectExpression") {
    for (const property of expression.properties) {
      checkClassProperty({ context, property, sourceText });
    }
  }
}

/**
 * Object properties show up in both `clsx({ "class": condition })` and `cva`
 * variant maps. Values are always safe to inspect; string keys are checked only
 * when the value is not itself another class expression.
 */
function checkClassProperty({ context, property, sourceText }) {
  if (property.type !== "Property") {
    return;
  }

  const valueCanContainClassString = canContainClassString(property.value);

  if (valueCanContainClassString) {
    checkClassExpression({ context, expression: property.value, sourceText });
  }

  if (!valueCanContainClassString && property.key.type === "Literal") {
    checkClassExpression({ context, expression: property.key, sourceText });
  }
}

/**
 * A helper call inside `className={...}` is already covered by the surrounding
 * JSX attribute visitor, so skipping it here prevents duplicate diagnostics.
 */
function isInsideClassAttribute({ context, node }) {
  return context.sourceCode
    .getAncestors(node)
    .some((ancestor) => ancestor.type === "JSXAttribute" && isClassAttributeName(ancestor.name));
}

export default defineRule({
  create(context) {
    const sourceText = context.sourceCode.getText();

    return {
      CallExpression(node) {
        const classFunctionName = getClassFunctionName(node.callee);

        if (!classFunctionName || !CLASS_FUNCTION_NAMES.has(classFunctionName)) {
          return;
        }

        if (isInsideClassAttribute({ context, node })) {
          return;
        }

        for (const argument of node.arguments) {
          checkClassExpression({ context, expression: argument, sourceText });
        }
      },

      JSXAttribute(node) {
        if (!isClassAttributeName(node.name) || !node.value) {
          return;
        }

        if (node.value.type === "Literal") {
          reportClassString({ context, node: node.value, sourceText });

          return;
        }

        if (node.value.type === "JSXExpressionContainer") {
          checkClassExpression({ context, expression: node.value.expression, sourceText });
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Require Tailwind utility classes to use the canonical spelling returned by Tailwind CSS",
    },
    fixable: "code",
    messages: { useCanonicalClass: "Use '{{expected}}' instead of '{{actual}}'." },
    schema: [],
    type: "suggestion",
  },
});
