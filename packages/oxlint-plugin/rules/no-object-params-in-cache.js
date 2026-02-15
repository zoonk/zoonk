import { defineRule } from "@oxlint/plugins";

function isObjectPattern(param) {
  return param.type === "ObjectPattern";
}

function isObjectTypeLiteral(typeAnnotation) {
  if (!typeAnnotation) {
    return false;
  }

  const inner = typeAnnotation.typeAnnotation;

  if (!inner) {
    return false;
  }

  return inner.type === "TSTypeLiteral";
}

function isAllowedTypeReference(typeAnnotation, exceptions) {
  if (!typeAnnotation) {
    return false;
  }

  const inner = typeAnnotation.typeAnnotation;

  if (!inner) {
    return false;
  }

  if (inner.type !== "TSTypeReference") {
    return false;
  }

  const typeName = inner.typeName;

  if (!typeName) {
    return false;
  }

  const name = typeName.type === "Identifier" ? typeName.name : null;

  return name && exceptions.includes(name.toLowerCase());
}

function getParamName(param) {
  if (param.type === "Identifier") {
    return param.name;
  }

  if (param.type === "ObjectPattern") {
    return "(destructured object)";
  }

  if (param.type === "AssignmentPattern" && param.left) {
    return getParamName(param.left);
  }

  return "(unknown)";
}

function isParamViolation(param, exceptions) {
  // Destructured object pattern like ({ orgSlug }) is always a violation
  if (isObjectPattern(param)) {
    return true;
  }

  const typeAnnotation = param.typeAnnotation;

  // No type annotation means we can't determine if it's an object
  if (!typeAnnotation) {
    return false;
  }

  // Allowed type references like Headers are not violations
  if (isAllowedTypeReference(typeAnnotation, exceptions)) {
    return false;
  }

  // Object type literals like { orgSlug: string } are violations
  return isObjectTypeLiteral(typeAnnotation);
}

export default defineRule({
  createOnce(context) {
    let exceptions;
    let cacheImported;
    let cacheLocalName;

    return {
      before() {
        const options = context.options[0] || {};
        exceptions = (options.exceptions || ["headers"]).map((exception) =>
          exception.toLowerCase(),
        );
        cacheImported = false;
        cacheLocalName = "cache";
      },

      ImportDeclaration(node) {
        if (node.source.value !== "react") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && specifier.imported.name === "cache") {
            cacheImported = true;
            cacheLocalName = specifier.local?.name || "cache";
          }
        }
      },

      CallExpression(node) {
        if (!cacheImported) {
          return;
        }

        if (node.callee.type !== "Identifier" || node.callee.name !== cacheLocalName) {
          return;
        }

        const firstArg = node.arguments[0];

        if (!firstArg) {
          return;
        }

        const isFunctionArg =
          firstArg.type === "ArrowFunctionExpression" || firstArg.type === "FunctionExpression";

        if (!isFunctionArg) {
          return;
        }

        for (const param of firstArg.params) {
          const paramToCheck = param.type === "AssignmentPattern" ? param.left : param;

          const shouldReport = isParamViolation(paramToCheck, exceptions);

          if (shouldReport) {
            context.report({
              data: { name: getParamName(paramToCheck) },
              loc: paramToCheck.loc,
              messageId: "noObjectParams",
            });
          }
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Disallow object parameters in React's cache() function to prevent cache misses due to reference inequality",
    },
    messages: {
      noObjectParams:
        "Parameter '{{name}}' is an object type. React's cache() uses reference equality, so object parameters cause cache misses. Use primitive parameters instead.",
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          exceptions: {
            description: "Type names that are allowed as object parameters (case-insensitive)",
            items: { type: "string" },
            type: "array",
          },
        },
        type: "object",
      },
    ],
    type: "problem",
  },
});
