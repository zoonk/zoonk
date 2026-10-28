type QuantityPart = { numeric: boolean; text: string };

const NUMBER_RUN = /(?<number>[~≈+\-−]?\d[\d.,:]*(?:[\u00A0\u202F]?%)?)/u;

export function splitQuantity(text: string): QuantityPart[] {
  return text
    .split(NUMBER_RUN)
    .filter((part) => part !== "")
    .map((part) => ({ numeric: /^[~≈+\-−]?\d/u.test(part), text: part }));
}
