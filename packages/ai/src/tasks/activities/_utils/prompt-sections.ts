function formatItems(items: string[] | undefined): string {
  const cleanedItems = (items ?? []).map((item) => item.trim()).filter((item) => item.length > 0);

  if (cleanedItems.length === 0) {
    return "(none)";
  }

  return cleanedItems.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function formatConceptSections(params: {
  concepts: string[] | undefined;
  neighboringConcepts: string[] | undefined;
}): string {
  return `CONCEPTS: ${formatItems(params.concepts)}\nNEIGHBORING_CONCEPTS: ${formatItems(params.neighboringConcepts)}`;
}

export function formatTextStepSection(
  label: string,
  steps: { text: string; title: string }[],
): string {
  const stepLines = steps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.text}`)
    .join("\n");

  return `${label}: ${stepLines || "(none)"}`;
}
