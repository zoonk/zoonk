const MONEY_MARKS = ["R$", "US$", "A$", "C$", "zł", "$", "€", "£", "¥", "₹", "₩", "₺"];

const MARK = MONEY_MARKS.map((mark) => mark.replaceAll("$", String.raw`\$`)).join("|");
const AMOUNT = String.raw`\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;

const SIGN_AFTER_MARK = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?<mark>${MARK})(?<gap>\s?)(?<sign>[-−–])(?<amount>${AMOUNT})(?!\d)`,
  "gu",
);

/**
 * No locale writes the minus between the money mark and the amount ("R$ -2.000,00"). Only the sign
 * moves in front of the mark; the amount stays exactly as written, since a sign repair must never
 * change what the amount says.
 */
export function repairNegativeMoney({ text }: { text: string }): string {
  return text.replaceAll(SIGN_AFTER_MARK, "$<sign>$<mark>$<gap>$<amount>");
}
