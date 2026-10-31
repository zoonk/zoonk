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

function getTypeReferenceName(typeNode) {
  if (typeNode.type !== "TSTypeReference") {
    return null;
  }

  return typeNode.typeName.type === "Identifier" ? typeNode.typeName.name : null;
}

function isAllowedTypeReference({ exceptions, typeNode }) {
  const name = getTypeReferenceName(typeNode);

  return name ? exceptions.includes(name.toLowerCase()) : false;
}

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

function getTransparentType(typeNode) {
  if (typeNode.type === "TSParenthesizedType") {
    return typeNode.typeAnnotation;
  }

  if (typeNode.type === "TSTypeOperator" && typeNode.operator === "readonly") {
    return typeNode.typeAnnotation;
  }

  return null;
}

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

/** Imported types stay unreported: a syntax-only rule can't tell them from primitive unions. */
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

function isParamViolation({ exceptions, param, typeAliases }) {
  if (param.type === "ObjectPattern") {
    return true;
  }

  const typeAnnotation = param.typeAnnotation;

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
