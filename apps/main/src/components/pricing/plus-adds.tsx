import { ProductWindow } from "@/components/public/product-window";
import { Stop, StopBody, StopHeader, StopTitle } from "@/components/public/stop";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { Eyebrow } from "@zoonk/learn/eyebrow";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

const PLUS_ADDS_TITLE_ID = "plus-adds";

/** The picture's example: a plan at 15 minutes a day has about four short lessons each weekday. */
const EXAMPLE_MINUTES = 15;
const EXAMPLE_LESSONS_A_DAY = 4;

const WEEKS_IN_PICTURE = 4;
const WEEKDAYS_IN_WEEK = 5;

const WEEKS = Array.from({ length: WEEKS_IN_PICTURE }, (_, week) => week);
const WEEKDAYS = Array.from({ length: WEEKDAYS_IN_WEEK }, (_, day) => day);

const MONTH_ROW_CLASS =
  "grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)]";

const WEEKS_CLASS = "grid grid-cols-4 gap-2";

/** One mark is one weekday of study. */
function MonthRow({
  caption,
  daysCovered,
  name,
}: {
  caption: string;
  daysCovered: number;
  name: string;
}) {
  return (
    <div className={MONTH_ROW_CLASS}>
      <p className="text-sm font-semibold">{name}</p>

      <div aria-hidden="true" className={WEEKS_CLASS}>
        {WEEKS.map((week) => (
          <MeterParts className="h-2.5" key={week}>
            {WEEKDAYS.map((day) => (
              <MeterPart
                className={cn(week * WEEKDAYS.length + day < daysCovered && "bg-foreground")}
                key={day}
              />
            ))}
          </MeterParts>
        ))}
      </div>

      <p className="text-muted-foreground text-compact col-start-2 sm:col-start-3">{caption}</p>
    </div>
  );
}

async function WeekLabels() {
  const t = await getExtracted();

  return (
    <div aria-hidden="true" className={cn(MONTH_ROW_CLASS, "-mb-2")}>
      <div className={cn(WEEKS_CLASS, "text-muted-foreground col-start-2 text-xs")}>
        {WEEKS.map((week) => (
          <span key={week}>{t("Week {number, number}", { number: week + 1 })}</span>
        ))}
      </div>
    </div>
  );
}

export async function PlusAdds() {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const lessons = getFreePlanLimits().lessonsPer30Days ?? 0;
  const freeDays = Math.ceil(lessons / EXAMPLE_LESSONS_A_DAY);

  return (
    <Stop aria-labelledby={PLUS_ADDS_TITLE_ID} band>
      <StopHeader>
        <Eyebrow>
          {t({
            description: "Small label over a section that shows what a subscription adds.",
            message: "What Plus adds",
          })}
        </Eyebrow>

        <StopTitle id={PLUS_ADDS_TITLE_ID}>
          {t(
            "At {minutes, number} minutes a day, {lessons, plural, one {# lesson lasts} other {# lessons last}} {days, plural, =5 {about a week} =10 {about two weeks} one {a day} other {about # days of study}}.",
            { days: freeDays, lessons, minutes: EXAMPLE_MINUTES },
          )}
        </StopTitle>
      </StopHeader>

      <StopBody>
        <ProductWindow className="flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{t("A month of a plan")}</p>
            <p className="text-muted-foreground text-compact">
              {t({
                description:
                  "Under a picture of a month of study: the example it draws. {time} is a duration such as “15 min”.",
                message:
                  "Example · {time} a day, about {count, plural, one {# short lesson} other {# short lessons}}",
                values: { count: EXAMPLE_LESSONS_A_DAY, time: minutesText(EXAMPLE_MINUTES) },
              })}
            </p>
          </div>

          <WeekLabels />

          <MonthRow
            caption={t(
              "{lessons, plural, one {# lesson} other {# lessons}}: {days, plural, =5 {about the first week} =10 {about the first two weeks} one {the first day} other {the first # days of study}}",
              { days: freeDays, lessons },
            )}
            daysCovered={freeDays}
            name={t("Free")}
          />

          <MonthRow
            caption={t("Every lesson, all month")}
            daysCovered={WEEKS.length * WEEKDAYS.length}
            name={t("Plus")}
          />
        </ProductWindow>
      </StopBody>
    </Stop>
  );
}
