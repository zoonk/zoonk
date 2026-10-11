/** A block marker on a line of its own, with its line break, so a dropped block leaves no blank line. */
const OWN_LINE_MARKER = /^(?<marker>\{\{[#/]\w+\}\})\n/gmu;

/** The outermost block of one variant: `{{#name}}…{{/name}}`. */
const VARIANT_BLOCK = /\{\{#(?<name>\w+)\}\}(?<body>[\s\S]*?)\{\{\/\k<name>\}\}/gu;

const LEFTOVER_MARKER = /\{\{[#/]\w+\}\}/u;

function resolveBlocks({
  text,
  variants,
}: {
  text: string;
  variants: Readonly<Record<string, boolean>>;
}): string {
  return text.replace(VARIANT_BLOCK, (_block, name: string, body: string) => {
    if (!Object.hasOwn(variants, name)) {
      throw new Error(`Unknown prompt variant "${name}"`);
    }

    return variants[name] ? resolveBlocks({ text: body, variants }) : "";
  });
}

/**
 * One call's prompt from a template whose variant rules sit in `{{#name}}…{{/name}}` blocks where
 * they belong: a block stays, in place, when its variant applies and is left out otherwise. A call
 * never reads the rules of a variant it isn't (an exam's rules on a learn goal), and a variant's
 * prompt reads exactly like the full template, with nothing moved. Every block's name must be one of
 * `variants`, so a misspelled block fails instead of always being dropped.
 */
export function selectPromptVariants({
  template,
  variants,
}: {
  template: string;
  variants: Readonly<Record<string, boolean>>;
}): string {
  const text = resolveBlocks({ text: template.replace(OWN_LINE_MARKER, "$<marker>"), variants });

  if (LEFTOVER_MARKER.test(text)) {
    throw new Error("A prompt variant block isn't closed");
  }

  return text;
}
