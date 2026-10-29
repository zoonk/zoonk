import { expect, test } from "vitest";
import { completePluralCategories } from "./plural-categories.mts";

const DAYS = [
  "<resources>",
  '    <plurals name="days_left">',
  '        <item quantity="one">%d jour restant</item>',
  '        <item quantity="other">%d jours restants</item>',
  "    </plurals>",
  "</resources>",
].join("\n");

test("a category the locale has gets the other text, in CLDR order", () => {
  expect(completePluralCategories({ locale: "fr", xml: DAYS })).toBe(
    [
      "<resources>",
      '    <plurals name="days_left">',
      '        <item quantity="one">%d jour restant</item>',
      '        <item quantity="many">%d jours restants</item>',
      '        <item quantity="other">%d jours restants</item>',
      "    </plurals>",
      "</resources>",
    ].join("\n"),
  );
});

test("plurals already complete and locales without more categories stay as they are", () => {
  expect(completePluralCategories({ locale: "de", xml: DAYS })).toBe(DAYS);

  const complete = completePluralCategories({ locale: "fr", xml: DAYS });
  expect(completePluralCategories({ locale: "fr", xml: complete })).toBe(complete);
});
