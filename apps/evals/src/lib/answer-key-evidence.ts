type LabelItem = <Item extends object>(
  item: Item,
  itemLocator: string,
) => Item & { itemLocator: string };

export function answerKeyEvidence(build: (label: LabelItem) => unknown) {
  const keyFlawLocators: string[] = [];

  const result = build((item, itemLocator) => {
    keyFlawLocators.push(itemLocator);
    return { ...item, itemLocator };
  });

  return { keyFlawLocators, keySolveOutput: JSON.stringify(result) };
}
