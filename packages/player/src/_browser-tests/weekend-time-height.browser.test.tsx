import { render } from "@testing-library/react";
import { SUPPORTED_LOCALES, getFormattingLocale } from "@zoonk/utils/locale";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, describe, expect, it } from "vitest";
import { WeekendMinutes } from "../../../learn/src/onboarding/steps/study-week";

const WIDTHS = [272, 342, 390];
const FONT = "Weekend Time Geist";
const cases = SUPPORTED_LOCALES.flatMap((locale) => WIDTHS.map((width) => ({ locale, width })));

const fontUrl = new URL(
  "../../../../apps/main/src/lib/certificates/fonts/shaping/Geist-Variable.ttf",
  import.meta.url,
);

function blockHeight({
  locale,
  missing,
  width,
}: {
  locale: string;
  missing: "weekdays" | "weekend" | null;
  width: number;
}): number {
  const { container, unmount } = render(
    <NextIntlClientProvider locale={getFormattingLocale(locale)} timeZone="UTC">
      <div lang={locale} style={{ fontFamily: FONT, width }}>
        <WeekendMinutes
          checked
          minutes={60}
          missing={missing}
          onChange={() => {}}
          onCheckedChange={() => {}}
          weekdayMinutes={30}
        />
      </div>
    </NextIntlClientProvider>,
  );

  const block = container.querySelector('[data-slot="weekend-time"]');

  if (!block) {
    throw new Error("The weekend time block is missing");
  }

  const { height } = block.getBoundingClientRect();
  unmount();
  return height;
}

describe("Weekend time", () => {
  beforeAll(async () => {
    const font = new FontFace(FONT, `url("${fontUrl.href}")`, { weight: "100 900" });
    document.fonts.add(await font.load());

    return () => {
      document.fonts.delete(font);
    };
  });

  it.each(cases)(
    "keeps its height in $locale at $width px when the study days leave no weekend or no weekday",
    ({ locale, width }) => {
      const withField = blockHeight({ locale, missing: null, width });

      expect(blockHeight({ locale, missing: "weekend", width })).toBe(withField);
      expect(blockHeight({ locale, missing: "weekdays", width })).toBe(withField);
    },
  );
});
