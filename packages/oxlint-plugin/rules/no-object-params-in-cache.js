import { defineRule } from "@oxlint/plugins";

const OBJECT_TYPE_REFERENCES = new Set([
  "Array",
  "Date",
  "Map",
  "Promise",
  "ReadonlyArray",
  "Set",
  "WeakMap",
  "WeakSet",
]);

/**
 * Destructuring proves that a cache parameter receives one object even when no TypeScript
 * annotation is present, so this syntax can always be reported safely.
 */
function isObjectPattern(param) {
  return param.type === "ObjectPattern";
}

/**
 * Only simple type-reference names can match local aliases, built-in object types, or configured
 * exceptions. Qualified names remain unknown rather than being guessed from partial syntax.
 */
function getTypeReferenceName(typeNode) {
  if (typeNode.type !== "TSTypeReference") {
    return null;
  }

  return typeNode.typeName.type === "Identifier" ? typeNode.typeName.name : null;
}

/**
 * Some reference-valued arguments, such as request Headers, are deliberately shared by identity.
 * Keeping that policy configurable prevents the object detector from overriding known exceptions.
 */
function isAllowedTypeReference({ exceptions, typeNode }) {
  const name = getTypeReferenceName(typeNode);

  return name ? exceptions.includes(name.toLowerCase()) : false;
}

/**
 * Next generates route params as a Promise hidden behind an indexed PageProps type. Recognizing
 * that syntax keeps the rule useful without treating every indexed access as an object.
 */
function isNextRouteParams(typeNode) {
  if (typeNode.type !== "TSIndexedAccessType") {
    return false;
  }

  const objectTypeName = getTypeReferenceName(typeNode.objectType);
  const indexType = typeNode.indexType;
  const indexName = indexType.type === "TSLiteralType" ? indexType.literal.value : null;

  return (
    (objectTypeName === "LayoutProps" || objectTypeName === "PageProps") && indexName === "params"
  );
}

/**
 * Local aliases preserve readable public types but can hide reference-valued cache parameters from
 * a syntax-only rule. Following those aliases catches the object shape without guessing about
 * imported aliases that may resolve to primitive unions.
 */
function isObjectType({ exceptions, typeAliases, typeNode, visitedAliases = new Set() }) {
  if (
    typeNode.type === "TSArrayType" ||
    typeNode.type === "TSConstructorType" ||
    typeNode.type === "TSFunctionType" ||
    typeNode.type === "TSMappedType" ||
    typeNode.type === "TSObjectKeyword" ||
    typeNode.type === "TSTupleType" ||
    typeNode.type === "TSTypeLiteral"
  ) {
    return true;
  }

  if (typeNode.type === "TSParenthesizedType") {
    return isObjectType({
      exceptions,
      typeAliases,
      typeNode: typeNode.typeAnnotation,
      visitedAliases,
    });
  }

  if (typeNode.type === "TSUnionType" || typeNode.type === "TSIntersectionType") {
    return typeNode.types.some((member) =>
      isObjectType({ exceptions, typeAliases, typeNode: member, visitedAliases }),
    );
  }

  if (isNextRouteParams(typeNode)) {
    return true;
  }

  if (typeNode.type !== "TSTypeReference" || isAllowedTypeReference({ exceptions, typeNode })) {
    return false;
  }

  const name = getTypeReferenceName(typeNode);

  if (!name) {
    return false;
  }

  if (OBJECT_TYPE_REFERENCES.has(name)) {
    return true;
  }

  const aliasedType = typeAliases.get(name);

  if (!aliasedType || visitedAliases.has(name)) {
    return false;
  }

  return isObjectType({
    exceptions,
    typeAliases,
    typeNode: aliasedType,
    visitedAliases: new Set([...visitedAliases, name]),
  });
}

/**
 * Diagnostics should name the declared parameter regardless of defaults or rest syntax so the
 * developer can identify the unstable cache key immediately.
 */
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

  if (param.type === "RestElement") {
    return getParamName(param.argument);
  }

  return "(unknown)";
}

/**
 * A rest annotation describes the array collected inside the function, not a single cache key.
 * Inspecting its element type distinguishes safe primitive rest arguments from object arguments.
 */
function isParamViolation({ exceptions, param, typeAliases }) {
  // Destructured object pattern like ({ orgSlug }) is always a violation
  if (isObjectPattern(param)) {
    return true;
  }

  const typeAnnotation = param.typeAnnotation;

  // No type annotation means we can't determine if it's an object
  if (!typeAnnotation) {
    return false;
  }

  const parameterType = typeAnnotation.typeAnnotation;

  const cacheArgumentType =
    param.type === "RestElement" && parameterType.type === "TSArrayType"
      ? parameterType.elementType
      : parameterType;

  return isObjectType({ exceptions, typeAliases, typeNode: cacheArgumentType });
}

export default defineRule({
  createOnce(context) {
    let exceptions;
    let cacheImported;
    let cacheLocalName;
    let typeAliases;

    return {
      before() {
        const options = context.options[0] || {};

        exceptions = (options.exceptions || ["headers"]).map((exception) =>
          exception.toLowerCase(),
        );

        cacheImported = false;
        cacheLocalName = "cache";
        typeAliases = new Map();
      },

      TSTypeAliasDeclaration(node) {
        typeAliases.set(node.id.name, node.typeAnnotation);
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

          const shouldReport = isParamViolation({ exceptions, param: paramToCheck, typeAliases });

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
