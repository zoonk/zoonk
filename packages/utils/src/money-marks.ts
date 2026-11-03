export const CURRENCY_MARKS: ReadonlyMap<string, string> = new Map([
  ["$", "USD"],
  ["A$", "AUD"],
  ["C$", "CAD"],
  ["R$", "BRL"],
  ["US$", "USD"],
  ["zł", "PLN"],
  ["£", "GBP"],
  ["¥", "JPY"],
  ["₩", "KRW"],
  ["€", "EUR"],
  ["₹", "INR"],
  ["₺", "TRY"],
]);

export const CURRENCY_WORDS: ReadonlyMap<string, string> = new Map([
  ["dollar", "USD"],
  ["dollars", "USD"],
  ["dólar", "USD"],
  ["dólares", "USD"],
  ["euro", "EUR"],
  ["euros", "EUR"],
  ["peso", "peso"],
  ["pesos", "peso"],
  ["reais", "BRL"],
  ["real", "BRL"],
]);

function toAlternatives(currencies: ReadonlyMap<string, string>): string {
  return [...currencies.keys()]
    .toSorted((first, second) => second.length - first.length)
    .map((word) => word.replaceAll("$", String.raw`\$`))
    .join("|");
}

export const MONEY_MARK = toAlternatives(CURRENCY_MARKS);
export const MONEY_WORD = toAlternatives(CURRENCY_WORDS);
