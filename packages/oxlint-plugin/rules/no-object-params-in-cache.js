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

const ARRAY_TYPE_REFERENCES = new Set(["Array", "ReadonlyArray"]);
const COMPOSITE_TYPE_NODES = new Set(["TSIntersectionType", "TSUnionType"]);

const OBJECT_TYPE_NODES = new Set([
  "TSArrayType",
  "TSConstructorType",
  "TSFunctionType",
  "TSMappedType",
  "TSObjectKeyword",
  "TSTupleType",
  "TSTypeLiteral",
]);

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
 * A tuple rest annotation describes separate runtime arguments. Unwrapping optional, named, and
 * nested rest elements lets the rule inspect each cache key instead of treating the tuple itself as
 * one object.
 */
function getTupleCacheArgument(element) {
  if (element.type === "TSNamedTupleMember") {
    return getTupleCacheArgument(element.elementType);
  }

  if (element.type === "TSOptionalType") {
    return { spreadsArguments: false, typeNode: element.typeAnnotation };
  }

  if (element.type === "TSRestType") {
    return { spreadsArguments: true, typeNode: element.typeAnnotation };
  }

  return { spreadsArguments: false, typeNode: element };
}

/**
 * Parentheses and the readonly modifier change TypeScript syntax without changing whether the
 * runtime value is reference-valued. Returning their inner type keeps that normalization out of
 * the main classifier.
 */
function getTransparentType(typeNode) {
  if (typeNode.type === "TSParenthesizedType") {
    return typeNode.typeAnnotation;
  }

  if (typeNode.type === "TSTypeOperator" && typeNode.operator === "readonly") {
    return typeNode.typeAnnotation;
  }

  return null;
}

/**
 * Rest parameter annotations describe a collection, while React receives each collected value as
 * its own cache key. This returns null for non-collection syntax so normal object classification can
 * continue.
 */
function getSpreadObjectResult({
  exceptions,
  spreadsArguments,
  typeAliases,
  typeNode,
  visitedAliases,
}) {
  if (!spreadsArguments) {
    return null;
  }

  if (typeNode.type === "TSArrayType") {
    return isObjectType({
      exceptions,
      typeAliases,
      typeNode: typeNode.elementType,
      visitedAliases,
    });
  }

  if (typeNode.type === "TSTupleType") {
    return typeNode.elementTypes.some((element) =>
      isTupleCacheArgumentObject({ element, exceptions, typeAliases, visitedAliases }),
    );
  }

  const name = getTypeReferenceName(typeNode);

  if (!name || !ARRAY_TYPE_REFERENCES.has(name)) {
    return null;
  }

  const elementType = typeNode.typeArguments?.params[0];

  return elementType
    ? isObjectType({ exceptions, typeAliases, typeNode: elementType, visitedAliases })
    : false;
}

/**
 * Named types may be known reference-valued built-ins or local aliases. Imported unknown types stay
 * unreported because this syntax-only rule cannot safely distinguish object types from primitive
 * unions defined in another module.
 */
function isTypeReferenceObject({
  exceptions,
  spreadsArguments,
  typeAliases,
  typeNode,
  visitedAliases,
}) {
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
    spreadsArguments,
    typeAliases,
    typeNode: aliasedType,
    visitedAliases: new Set([...visitedAliases, name]),
  });
}

/**
 * React compares each runtime cache argument by identity. Following local aliases and TypeScript
 * wrappers reveals reference-valued keys while spread annotations are inspected as the separate
 * arguments they produce.
 */
function isObjectType({
  exceptions,
  spreadsArguments = false,
  typeAliases,
  typeNode,
  visitedAliases = new Set(),
}) {
  const transparentType = getTransparentType(typeNode);

  if (transparentType) {
    return isObjectType({
      exceptions,
      spreadsArguments,
      typeAliases,
      typeNode: transparentType,
      visitedAliases,
    });
  }

  if (COMPOSITE_TYPE_NODES.has(typeNode.type)) {
    return typeNode.types.some((member) =>
      isObjectType({ exceptions, spreadsArguments, typeAliases, typeNode: member, visitedAliases }),
    );
  }

  const spreadObjectResult = getSpreadObjectResult({
    exceptions,
    spreadsArguments,
    typeAliases,
    typeNode,
    visitedAliases,
  });

  if (spreadObjectResult !== null) {
    return spreadObjectResult;
  }

  if (OBJECT_TYPE_NODES.has(typeNode.type) || isNextRouteParams(typeNode)) {
    return true;
  }

  return isTypeReferenceObject({
    exceptions,
    spreadsArguments,
    typeAliases,
    typeNode,
    visitedAliases,
  });
}

/**
 * Tuple elements may be optional, named, or themselves variadic. Normalizing one element before
 * classification keeps the tuple traversal declarative and preserves nested rest semantics.
 */
function isTupleCacheArgumentObject({ element, exceptions, typeAliases, visitedAliases }) {
  const cacheArgument = getTupleCacheArgument(element);

  return isObjectType({
    exceptions,
    spreadsArguments: cacheArgument.spreadsArguments,
    typeAliases,
    typeNode: cacheArgument.typeNode,
    visitedAliases,
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
  if (param.type === "ObjectPattern") {
    return true;
  }

  const typeAnnotation = param.typeAnnotation;

  // No type annotation means we can't determine if it's an object
  if (!typeAnnotation) {
    return false;
  }

  return isObjectType({
    exceptions,
    spreadsArguments: param.type === "RestElement",
    typeAliases,
    typeNode: typeAnnotation.typeAnnotation,
  });
}

export default defineRule({
  createOnce(context) {
    let exceptions;
    let cacheImported;
    let cacheLocalName;
    let paramsToCheck;
    let typeAliases;

    return {
      before() {
        const options = context.options[0] || {};

        exceptions = (options.exceptions || ["headers"]).map((exception) =>
          exception.toLowerCase(),
        );

        cacheImported = false;
        cacheLocalName = "cache";
        paramsToCheck = [];
        typeAliases = new Map();
      },

      after() {
        for (const param of paramsToCheck) {
          if (isParamViolation({ exceptions, param, typeAliases })) {
            context.report({
              data: { name: getParamName(param) },
              loc: param.loc,
              messageId: "noObjectParams",
            });
          }
        }
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
          paramsToCheck.push(paramToCheck);
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
