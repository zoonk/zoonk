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

function numericLiterals(value: unknown): value is Node[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item: unknown) => object(item) && item.type === "number" && Array.isArray(item.enum),
    )
  );
}

type Document = { components?: { schemas?: object; responses?: object }; paths?: object };

function responseSchemas(document: Document, resolve: (value: unknown) => Node | undefined) {
  const found = new Set<Node>();

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
    } else if (object(value) && !found.has(value)) {
      found.add(value);

      if (typeof value.$ref === "string") {
        visit(resolve(value));
      }

      Object.values(value).forEach((item) => visit(item));
    }
  }

  for (const node of nodes(document.paths)) {
    if (node.responses) {
      visit(node.responses);
    }
  }

  visit(document.components?.responses);
  return found;
}

function stringValues(field: Node | undefined): string[] {
  const values = field?.enum;
  return Array.isArray(values) && values.every((value) => typeof value === "string") ? values : [];
}

type Branch = Map<string, Node>;

type Group = {
  tag: string;
  keys: Set<string>;
  branches: Branch[][];
  variants: unknown[];
  node: Node;
};

function keysFor(branches: Branch[], tag: string) {
  return new Set(branches.flatMap((branch) => stringValues(branch.get(tag))));
}

function tagFor(node: Node, branches: Branch[][]) {
  const fields = branches.flat()[0];
  const discriminator = object(node.discriminator) ? node.discriminator.propertyName : undefined;

  const candidates =
    typeof discriminator === "string" ? [discriminator] : [...(fields?.keys() ?? [])];

  return candidates.find((key) => {
    if (!branches.flat().every((branch) => stringValues(branch.get(key)).length > 0)) {
      return false;
    }

    const groups = branches.map((group) => keysFor(group, key));

    return (
      groups.length > 1 &&
      groups.every((group, index) =>
        groups.slice(index + 1).every((other) => group.isDisjointFrom(other)),
      )
    );
  });
}

type Resolve = (value: unknown) => Node | undefined;

function leaves(variant: unknown, resolve: Resolve): Branch[] {
  const branch = resolve(variant);

  if (!branch) {
    return [];
  }

  const variants = branch.oneOf ?? branch.anyOf;

  if (Array.isArray(variants)) {
    return variants.flatMap((item) => leaves(item, resolve));
  }

  const fields = new Map<string, Node>();

  if (object(branch.properties) && Array.isArray(branch.required)) {
    for (const key of branch.required.filter((item): item is string => typeof item === "string")) {
      const field = resolve(branch.properties[key]);

      if (field && stringValues(field).length > 0) {
        fields.set(key, field);
      }
    }
  }

  return [fields];
}

function reserveSiblingTags(groups: Map<Node, Group>, resolve: Resolve) {
  // A nested union must leave its parent's other known variants for the parent to decode.
  for (const group of groups.values()) {
    for (const variant of group.variants) {
      const model = resolve(variant);
      const child = model && groups.get(model);

      if (child?.tag === group.tag) {
        for (const value of group.keys) {
          child.keys.add(value);
        }
      }
    }
  }
}

function appendFallback(group: Group, tags: Set<Node>) {
  const { branches, keys, node, tag, variants } = group;
  const fields = branches.flat();
  const fallback = { enum: [...keys, "__unknown_api_union_tag__"], type: "string" };
  const properties: Node = { [tag]: fallback };

  for (const [key, field] of fields[0] ?? []) {
    if (
      key === tag ||
      (stringValues(field).length === 1 &&
        fields.every(
          (branch) =>
            stringValues(branch.get(key)).length === 1 &&
            stringValues(branch.get(key))[0] === stringValues(field)[0],
        ))
    ) {
      for (const branch of fields) {
        const literal = branch.get(key);

        if (literal) {
          tags.add(literal);
        }
      }

      if (key !== tag) {
        properties[key] = field;
      }
    }
  }

  delete node.discriminator;

  variants.push({ properties, required: Object.keys(properties), type: "object" });
  return fallback;
}

function projectEnums(
  enums: Node[],
  fallbacks: Set<Node>,
  tags: Set<Node>,
  responseNodes: Set<Node>,
  platform: "apple" | "android",
) {
  for (const field of enums) {
    if (fallbacks.has(field)) {
      if (platform === "android") {
        field["x-zoonk-unknown-tag"] = true;
      }
    } else if (tags.has(field) || !responseNodes.has(field)) {
      if (platform === "android") {
        field["x-zoonk-closed-enum"] = true;
      }
    } else if (platform === "apple" && Array.isArray(field.enum)) {
      const values: readonly unknown[] = field.enum;
      field.enum = [...values, "__unknown_api_value__"];
    }
  }
}

/** A union branch must still reject another branch's tag, even when both have the same shape. */
export function prepareNativeEnums(document: Document, platform: "apple" | "android") {
  const schemas: Node = { ...document.components?.schemas };
  const tags = new Set<Node>();
  const fallbacks = new Set<Node>();
  const enums: Node[] = [];
  const groups = new Map<Node, Group>();

  function resolve(value: unknown): Node | undefined {
    if (!object(value)) {
      return;
    }

    return typeof value.$ref === "string"
      ? resolve(schemas[value.$ref.replace("#/components/schemas/", "")])
      : value;
  }

  const responseNodes = responseSchemas(document, resolve);

  for (const node of nodes(document)) {
    if (numericLiterals(node.anyOf)) {
      node.type = "number";
      delete node.anyOf;
    }

    if (node.type === "string" && Array.isArray(node.enum)) {
      enums.push(node);
    }

    const variants = node.oneOf ?? node.anyOf;

    if (Array.isArray(variants) && responseNodes.has(node)) {
      if (node === schemas.StudyDay) {
        // Saved and unopened days share the fields Today displays. A saved day requires its ID.
        delete node.discriminator;
      } else {
        const branches = variants.map((variant) => leaves(variant, resolve));
        const tag = tagFor(node, branches);

        if (tag) {
          groups.set(node, { branches, keys: keysFor(branches.flat(), tag), node, tag, variants });
        }
      }
    }
  }

  reserveSiblingTags(groups, resolve);

  for (const group of groups.values()) {
    const fallback = appendFallback(group, tags);
    enums.push(fallback);
    fallbacks.add(fallback);
  }

  projectEnums(enums, fallbacks, tags, responseNodes, platform);
}
