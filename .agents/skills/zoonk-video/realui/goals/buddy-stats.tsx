// The /level and /energy stats pages, from Main's components (copied as client components by buddy-gen.py).
import { ProgressContent } from "@repo/apps/main/src/app/[lang]/(app)/(stats)/_components/progress-content.tsx";
import { calculateBeltLevel, getNextBelt } from "@repo/packages/utils/src/belt-level.ts";
import { getContributionCalendarDateRangeFromEndDate } from "@repo/packages/utils/src/contribution-calendar.ts";
import { useExtracted } from "next-intl";
import { type Lang } from "../story";
import { DEFAULT_BP, buddyStatus, tabBuddy } from "./buddy-energy";
import { EnergyChart } from "./buddy-main-energy-chart";
import { EnergyLine, EnergyTiles } from "./buddy-main-energy-stats";
import { LevelProgression } from "./buddy-main-level-progression";
import { LevelLine, LevelTiles } from "./buddy-main-level-stats";
import { SectionPage } from "./buddy-main-section-page";
import { StatsPage } from "./buddy-main-stats-page";
import { AppFrame } from "./shell";

const MS_PER_DAY = 86_400_000;
const TODAY = new Date("2026-11-03T00:00:00Z");
const STARTED = new Date("2026-09-14T00:00:00Z");

/** The (stats) layout: the section bar on phones, "All goals" and the tabs from a tablet up. */
function StatsSection({ children, path }: { children: React.ReactNode; path: string }) {
  const t = useExtracted();
  (globalThis as any).__BUDDY_PATH = path;

  return (
    <SectionPage
      eyebrow={t("All goals")}
      hub={{ href: "/stats", title: t("Statistics") }}
      nav={null}
    >
      {children}
    </SectionPage>
  );
}

function StatsFrame({
  children,
  lang,
  path,
  q,
}: {
  children: React.ReactNode;
  lang: Lang;
  path: string;
  q: URLSearchParams;
}) {
  const status = buddyStatus({
    bp: Number(q.get("bp") ?? DEFAULT_BP),
    energy: Number(q.get("energy") ?? 82),
    lang,
    studied: true,
  });

  return (
    <AppFrame
      buddy={tabBuddy(status)}
      goal="exam"
      lang={lang}
      missions={{ done: 1, total: 3 }}
      tab={null}
      topBar={false}
    >
      <StatsSection path={path}>{children}</StatsSection>
    </AppFrame>
  );
}

function levelDetails(bp: number) {
  return { ...calculateBeltLevel(bp), nextBelt: getNextBelt(bp), totalBrainPower: bp };
}

function LevelBody({ bp }: { bp: number }) {
  const t = useExtracted();
  const level = levelDetails(bp);

  return (
    <StatsPage title={t("Level")}>
      <ProgressContent>
        <LevelTiles level={level} />
        <LevelProgression currentBelt={level} />
        <LevelLine />
      </ProgressContent>
    </StatsPage>
  );
}

export function LevelPage({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  return (
    <StatsFrame lang={lang} path="/level" q={q}>
      <LevelBody bp={Number(q.get("bp") ?? DEFAULT_BP)} />
    </StatsFrame>
  );
}

/** A learner who started mid-September: studies most weekdays, dips on days off, and ends at `current`. */
function energyDays(current: number) {
  const { endDate, startDate } = getContributionCalendarDateRangeFromEndDate(TODAY);
  const days: { date: Date; energy: number | null }[] = [];
  const total = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
  let energy = 20;

  for (let index = 0; index <= total; index += 1) {
    const date = new Date(startDate.getTime() + index * MS_PER_DAY);

    if (date < STARTED) {
      days.push({ date, energy: null });
      continue;
    }

    const weekday = date.getUTCDay();
    const off = weekday === 0 || (weekday === 6 && index % 3 === 0) || index % 17 === 0;
    energy = Math.max(5, Math.min(100, off ? energy - 6 : energy + 4 + (index % 5)));
    days.push({ date, energy });
  }

  days[days.length - 1] = { date: endDate, energy: current };
  return days;
}

function EnergyBody({ current }: { current: number }) {
  const t = useExtracted();
  const days = energyDays(current);
  const active = days.filter((day) => day.energy !== null) as { energy: number }[];
  const average = active.reduce((sum, day) => sum + day.energy, 0) / active.length;
  const full = active.filter((day) => day.energy >= 100).length;

  return (
    <StatsPage title={t("Energy")}>
      <ProgressContent>
        <EnergyTiles
          currentEnergy={current}
          insights={{ averageEnergy: average, fullEnergyDays: full }}
        />
        <EnergyChart days={days as any} />
        <EnergyLine />
      </ProgressContent>
    </StatsPage>
  );
}

export function EnergyStatsPage({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  return (
    <StatsFrame lang={lang} path="/energy" q={q}>
      <EnergyBody current={Number(q.get("energy") ?? 82)} />
    </StatsFrame>
  );
}
