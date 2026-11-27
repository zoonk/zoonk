import { render } from "@testing-library/react";
import { SUPPORTED_LOCALES, getFormattingLocale } from "@zoonk/utils/locale";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, describe, expect, it } from "vitest";
import { WeekdayToggles } from "../../../learn/src/onboarding/steps/study-week";

const WIDTHS = [272, 327, 342, 366, 368, 380];
const FONT = "Study Day Geist";
const cases = SUPPORTED_LOCALES.flatMap((locale) => WIDTHS.map((width) => ({ locale, width })));

const fontUrl = new URL(
  "../../../../apps/main/src/lib/certificates/fonts/shaping/Geist-Variable.ttf",
  import.meta.url,
);

function labelFits(button: HTMLButtonElement) {
  const range = document.createRange();
  range.selectNodeContents(button.querySelector("[data-slot=weekday-label]") ?? button);
  const fragments = [...range.getClientRects()];
  const box = button.getBoundingClientRect();

  return (
    fragments.length === 1 &&
    fragments.every(({ left, right }) => left >= box.left && right <= box.right)
  );
}

function naturalChipWidth(button: HTMLButtonElement, grid: HTMLElement): number {
  const probe = button.cloneNode(true) as HTMLButtonElement;

  probe.style.cssText =
    "position:absolute; visibility:hidden; width:max-content; padding-inline:0; white-space:nowrap";

  grid.append(probe);
  const { width } = probe.getBoundingClientRect();
  probe.remove();
  return width;
}

describe("Study day chips", () => {
  beforeAll(async () => {
    const font = new FontFace(FONT, `url("${fontUrl.href}")`, { weight: "100 900" });
    document.fonts.add(await font.load());

    return () => {
      document.fonts.delete(font);
    };
  });

  it.each(cases)(
    "fits whole $locale weekday labels in equal chips at $width px",
    ({ locale, width }) => {
      const { container } = render(
        <NextIntlClientProvider locale={getFormattingLocale(locale)} timeZone="UTC">
          <div lang={locale} style={{ fontFamily: FONT, width }}>
            <WeekdayToggles days={[1, 2, 3, 4, 5]} onChange={() => {}} />
          </div>
        </NextIntlClientProvider>,
      );

      const buttons = [...container.querySelectorAll("button")];
      const grid = buttons[0]?.parentElement;

      if (!grid) {
        throw new Error("The study day grid is missing");
      }

      const gap = Number(getComputedStyle(grid).columnGap.replace(/px$/u, ""));
      const track = (width - (buttons.length - 1) * gap) / buttons.length;
      const wraps = buttons.some((button) => naturalChipWidth(button, grid) > track);
      const boxes = buttons.map((button) => button.getBoundingClientRect());
      const rowCounts = new Map<number, number>();

      for (const box of boxes) {
        rowCounts.set(box.top, (rowCounts.get(box.top) ?? 0) + 1);
        expect(box.width).toBeCloseTo(boxes[0]?.width ?? 0, 1);
      }

      expect(buttons).toHaveLength(7);
      expect([...rowCounts.values()]).toStrictEqual(wraps ? [4, 3] : [7]);
      expect(buttons.every((button) => labelFits(button))).toBe(true);
    },
  );
});
