export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A stored code in words: `welcomeBack` and `multiple_choice` read "Welcome back" and "Multiple choice". */
export function toWords(code: string): string {
  return capitalize(
    code
      .replaceAll(/(?<lower>[a-z\d])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
      .replaceAll(/[_-]+/gu, " ")
      .toLowerCase(),
  );
}

export function formatDate(date: Date | string | null | undefined): string {
  return date ? new Date(date).toLocaleDateString("en", { dateStyle: "medium" }) : "—";
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return date
    ? new Date(date).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

const PERCENT_DIGITS = 1;

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(PERCENT_DIGITS)}%`;
}

export function formatCount(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}
