type Node = Record<string, unknown>;

function object(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function* nodes(value: unknown): Generator<Node> {
  if (object(value)) {
    yield value;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      yield* nodes(child);
    }
  }
}

function distinguishingTags(left: Map<string, Node>, right: Map<string, Node>) {
  let pair: Node[] = [];
  let fewestValues = Infinity;

  for (const [key, field] of left) {
    const other = right.get(key);
    const values = field.enum;
    const alternatives = other?.enum;

    if (
      other &&
      Array.isArray(values) &&
      Array.isArray(alternatives) &&
      values.length + alternatives.length < fewestValues &&
      values.every((value: unknown) => !alternatives.includes(value))
    ) {
      fewestValues = values.length + alternatives.length;
      pair = [field, other];
    }
  }

  return pair;
}

function numericLiterals(value: unknown): value is Node[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item: unknown) => object(item) && item.type === "number" && Array.isArray(item.enum),
    )
  );
}

/** A union branch must still reject another branch's tag, even when both have the same shape. */
export function prepareNativeEnums(
  document: { components?: { schemas?: object } },
  platform: "apple" | "android",
) {
  const schemas: Node = { ...document.components?.schemas };
  const tags = new Set<Node>();
  const enums: Node[] = [];

  function resolve(value: unknown): Node | undefined {
    if (!object(value)) {
      return;
    }

    return typeof value.$ref === "string"
      ? resolve(schemas[value.$ref.replace("#/components/schemas/", "")])
      : value;
  }

  function branchFields(variant: unknown) {
    const branch = resolve(variant);
    const fields = new Map<string, Node>();

    if (branch && Array.isArray(branch.enum)) {
      tags.add(branch);
    }

    if (object(branch?.properties) && Array.isArray(branch.required)) {
      for (const [key, property] of Object.entries(branch.properties)) {
        const field = resolve(property);

        if (branch.required.includes(key) && field && Array.isArray(field.enum)) {
          fields.set(key, field);
        }
      }
    }

    return fields;
  }

  function markTags(variants: unknown[], discriminator: unknown) {
    const branches = variants.map((variant) => branchFields(variant));

    if (object(discriminator) && typeof discriminator.propertyName === "string") {
      for (const fields of branches) {
        const tag = fields.get(discriminator.propertyName);

        if (tag) {
          tags.add(tag);
        }
      }
    } else {
      for (const [index, branch] of branches.entries()) {
        for (const sibling of branches.slice(index + 1)) {
          for (const field of distinguishingTags(branch, sibling)) {
            tags.add(field);
          }
        }
      }
    }
  }

  for (const node of nodes(document)) {
    if (numericLiterals(node.anyOf)) {
      node.type = "number";
      delete node.anyOf;
    }

    if (node.type === "string" && Array.isArray(node.enum)) {
      enums.push(node);
    }

    const variants = node.oneOf ?? node.anyOf;

    if (Array.isArray(variants)) {
      markTags(variants, node.discriminator);
    }
  }

  for (const field of enums) {
    if (tags.has(field)) {
      if (platform === "android") {
        field["x-zoonk-union-tag"] = true;
      }
    } else if (platform === "apple" && Array.isArray(field.enum)) {
      const values: readonly unknown[] = field.enum;
      field.enum = [...values, "__unknown_api_value__"];
    }
  }
}
