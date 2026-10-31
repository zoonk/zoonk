/** With its line break, so a dropped block leaves no blank line. */
const OWN_LINE_MARKER = /^(?<marker>\{\{[#/]\w+\}\})\n/gmu;

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

/** Every block's name must be in `variants`, so a misspelled block fails instead of vanishing. */
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
