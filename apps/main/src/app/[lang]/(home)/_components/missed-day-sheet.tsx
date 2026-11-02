import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { Variant } from "@/components/public/variant-switch";
import { getAppLocale } from "@/i18n/locale";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FileSpreadsheetIcon, XIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { addDays, getExampleCalendar, getExampleSet } from "./landing-examples";
import { CAPTION_CLASS, DAY_SWITCH } from "./missed-day";
import { toSheetWeekday } from "./sheet-weekday";

const FIRST_DAY = -2;
const YESTERDAY = -1;

async function Ticked() {
  const t = await getExtracted();

  return (
    <>
      <CheckIcon aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("Done")}</span>
    </>
  );
}

async function YesterdayMark() {
  const t = await getExtracted();

  return (
    <span className="grid *:col-start-1 *:row-start-1">
      <Variant as="span" name={DAY_SWITCH} stacked value="studied">
        <Ticked />
      </Variant>
      <Variant as="span" name={DAY_SWITCH} stacked value="missed">
        <XIcon aria-hidden="true" className="size-4" />
        <span className="sr-only">{t("Not done")}</span>
      </Variant>
    </span>
  );
}

async function SheetRow({ date, offset, title }: { date: Date; offset: number; title: string }) {
  const format = await getFormatter();
  const locale = await getAppLocale();
  const isYesterday = offset === YESTERDAY;
  const weekday = format.dateTime(date, { timeZone: "UTC", weekday: "short" });
  const day = format.dateTime(date, { day: "numeric", month: "numeric", timeZone: "UTC" });

  return (
    <tr className="h-12">
      <th
        className={cn(
          NUMERIC_CLASS,
          "text-muted-foreground w-px px-3.5 text-left text-[0.8125rem] font-normal whitespace-nowrap",
        )}
        scope="row"
      >
        {`${toSheetWeekday({ locale, weekday })} ${day}`}
      </th>
      <td
        className={cn(
          "px-3.5 transition-colors",
          isYesterday &&
            "[:root:has(input[name=landing-day][value=missed]:checked)_&]:text-muted-foreground",
        )}
      >
        {title}
      </td>
      <td className="text-muted-foreground w-px px-3.5">
        {offset < YESTERDAY && <Ticked />}
        {isYesterday && <YesterdayMark />}
      </td>
    </tr>
  );
}

export async function Spreadsheet() {
  const t = await getExtracted();
  const { exam } = await getExampleSet();
  const { today } = await getExampleCalendar();

  return (
    <figure className="min-w-0">
      <figcaption className={CAPTION_CLASS}>{t("In a spreadsheet")}</figcaption>

      <ProductWindow className="bg-transparent">
        <p className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2.25 text-xs">
          <FileSpreadsheetIcon aria-hidden="true" className="size-3.75 shrink-0" />
          <span className={cn(NUMERIC_CLASS, "truncate")}>{exam.missedDay.file}</span>
        </p>

        <table className="w-full border-collapse text-[0.9375rem]">
          <tbody className="divided-rows">
            {exam.missedDay.topics.map((topic, index) => (
              <SheetRow
                date={addDays(today, FIRST_DAY + index)}
                key={topic.title}
                offset={FIRST_DAY + index}
                title={topic.title}
              />
            ))}
          </tbody>
        </table>
      </ProductWindow>

      <p className="text-muted-foreground mt-3 grid text-sm leading-[1.45] *:col-start-1 *:row-start-1">
        <Variant as="span" name={DAY_SWITCH} stacked value="studied">
          {t("So far, so good.")}
        </Variant>
        <Variant as="span" name={DAY_SWITCH} stacked value="missed">
          {t("The spreadsheet doesn't change by itself. Now you redo the whole week by hand.")}
        </Variant>
      </p>
    </figure>
  );
}
