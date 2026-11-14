export function elementName(opening) {
  const { name } = opening;

  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  return name.type === "JSXMemberExpression" ? name.property.name : "";
}

function attribute(opening, key) {
  return opening.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === key);
}

/** A JSX element given as a prop's value, such as `render={<Link />}`. */
export function elementProp(opening, key) {
  const value = attribute(opening, key)?.value;

  return value?.type === "JSXExpressionContainer" && value.expression.type === "JSXElement"
    ? value.expression
    : null;
}

/** The source of its `className`, to find the pieces it's drawn with (`buttonVariants(…)`). */
export function classSource(context, opening) {
  const value = attribute(opening, "className")?.value;
  return value ? context.sourceCode.getText(value) : "";
}

/**
 * How many of a child list's own elements `count` matches: through fragments and expressions, not
 * into other elements. A conditional renders one branch, so the larger one counts.
 */
export function countChildren(children, count) {
  let total = 0;

  for (const child of children ?? []) {
    total += countNode(child, count);
  }

  return total;
}

function countNode(node, count) {
  switch (node?.type) {
    case "JSXElement":
      return count(node) ? 1 : 0;
    case "JSXFragment":
      return countChildren(node.children, count);
    case "JSXExpressionContainer":
      return countNode(node.expression, count);
    case "ConditionalExpression":
      return Math.max(countNode(node.consequent, count), countNode(node.alternate, count));
    case "LogicalExpression":
      return countNode(node.right, count);
    default:
      return 0;
  }
}
