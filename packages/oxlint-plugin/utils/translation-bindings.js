function isNamedCall(node, name) {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === name
  );
}

function getTranslationBinding({ call, binding, sourceCode }) {
  if (
    binding?.type !== "Identifier" ||
    !isNamedCall(call, "getExtracted") ||
    !["[", ","].includes(sourceCode.getTokenBefore(call).value)
  ) {
    return [];
  }

  return [{ call, name: binding.name }];
}

/** next-intl maps inline Promise.all elements to identifier bindings by position. */
export function getPromiseAllTranslationBindings({ node, sourceCode }) {
  if (node.id?.type !== "ArrayPattern" || node.init?.type !== "AwaitExpression") {
    return [];
  }

  const call = node.init.argument;

  if (
    call.type !== "CallExpression" ||
    call.optional ||
    call.callee.type !== "MemberExpression" ||
    call.callee.computed ||
    call.callee.optional ||
    call.callee.object.type !== "Identifier" ||
    call.callee.object.name !== "Promise" ||
    call.callee.property.name !== "all"
  ) {
    return [];
  }

  const array = call.arguments[0];

  if (
    array?.type !== "ArrayExpression" ||
    array.elements.some((element) => element?.type === "SpreadElement")
  ) {
    return [];
  }

  /** ESTree omits parentheses that still prevent next-intl's SWC pattern matching. */
  if (
    sourceCode.getTokenBefore(node.init).value !== "=" ||
    sourceCode.getTokenAfter(sourceCode.getFirstToken(node.init)).range[0] !== call.range[0] ||
    sourceCode.getFirstToken(call).range[0] !== call.callee.range[0] ||
    sourceCode.getTokenAfter(sourceCode.getTokenAfter(call.callee)).range[0] !== array.range[0]
  ) {
    return [];
  }

  return array.elements.flatMap((element, index) =>
    getTranslationBinding({ call: element, binding: node.id.elements[index], sourceCode }),
  );
}

export function getTranslationVariableNames({ node, sourceCode }) {
  if (node.id?.type !== "Identifier") {
    return getPromiseAllTranslationBindings({ node, sourceCode }).map((binding) => binding.name);
  }

  const call = node.init?.type === "AwaitExpression" ? node.init.argument : node.init;

  if (isNamedCall(call, "getExtracted") || isNamedCall(node.init, "useExtracted")) {
    return [node.id.name];
  }

  return [];
}
