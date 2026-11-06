// Plan tab views (plan-career, plan-learn, tools): the real JourneyScreen / SubjectScreen with view models built from story.ts.
import {
  type PlanView,
  type PlanPhaseView,
  type PlanChapterView,
  type PlanDayView,
} from "@repo/packages/core/src/plans/plan-view-contract.ts";
import {
  type SyllabusView,
  type SyllabusSubject,
} from "@repo/packages/core/src/view-models/syllabus/syllabus-contract.ts";
import {
  JourneyScreen,
  type JourneyLinks,
  type JourneyStanding,
} from "@repo/packages/learn/src/journey/journey-screen.tsx";
import { LearnProvider } from "@repo/packages/learn/src/learn-provider.tsx";
import { LearnBottomNavigation } from "@repo/packages/learn/src/shell/learn-navigation.tsx";
import {
  LearnShell,
  LearnShellContent,
  LearnShellMain,
} from "@repo/packages/learn/src/shell/learn-shell.tsx";
import { SubjectScreen } from "@repo/packages/learn/src/syllabus/subject-screen.tsx";
import { toSyllabusSection } from "@repo/packages/learn/src/syllabus/syllabus-section-view.ts";
import { AskTutor } from "@repo/packages/player/src/questions/ask-tutor.tsx";
import { useEffect, useMemo, type ReactNode } from "react";
import { ADAPTERS, CAREER_GOAL_ID, LEARN_GOAL_ID, S, TabShell, ZU, type ViewProps } from "./common";

const TODAY = "2026-11-03";
const WEEK_START = "2026-11-02";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Mon..Sun; weekdays study `minutes`, the weekend rests. Monday is before the plan started. */
function buildWeek({
  minutes,
  weekends,
}: {
  minutes: number;
  weekends: boolean;
}): PlanView["week"] {
  const days: PlanDayView[] = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(WEEK_START, offset);
    const weekend = offset >= 5;
    const studies = date >= TODAY && (weekends || !weekend);
    return {
      date,
      items: [],
      minutes: studies ? minutes : 0,
      mockFunding: null,
      state: date === TODAY ? "today" : studies ? "upcoming" : "rest",
    };
  });

  return { days, endDate: addDays(WEEK_START, 6), startDate: WEEK_START };
}

function chapter(input: Partial<PlanChapterView> & { title: string }): PlanChapterView {
  return {
    chapterId: `ch-${slug(input.title)}`,
    deeper: false,
    far: false,
    lessonsDone: 0,
    lessonsTotal: 0,
    nextDate: null,
    plannedLessons: null,
    skillId: null,
    skills: [],
    state: "upcoming",
    testedOut: false,
    writing: false,
    ...input,
  };
}

function phase(input: Partial<PlanPhaseView> & { index: number; name: string }): PlanPhaseView {
  return {
    challengeLeftOut: false,
    chapterCount: 1,
    chapters: [],
    checkpoint: null,
    endDate: null,
    hours: 10,
    kind: "learn",
    lessonsDone: 0,
    lessonsTotal: 0,
    milestone: null,
    mocks: { count: 0, nextDate: null },
    short: null,
    startDate: null,
    state: "upcoming",
    ...input,
  };
}

function basePlan(input: {
  goalId: string;
  phases: PlanPhaseView[];
  targetDate: string | null;
  minutes: number;
  weekends: boolean;
  endDate: string | null;
  feasibility: PlanView["feasibility"];
  tools?: PlanView["tools"];
  totalHours: number;
}): PlanView {
  const weekdayMinutes = [0, 1, 2, 3, 4, 5, 6].map((day) =>
    input.weekends || (day >= 1 && day <= 5) ? input.minutes : 0,
  );

  return {
    access: { freeUntil: "2026-11-10", freeWeekOver: false, mocksRequirePlus: false },
    areas: [],
    bases: null,
    changes: [],
    course: null,
    currentPhase: 0,
    estimate: {
      endDate: input.endDate,
      fullCourseEndDate: null,
      pace: { factor: 1, source: "typical" },
      remainingHours: input.totalHours,
      totalHours: input.totalHours,
    },
    numbers: null,
    examChoices: [],
    examDocument: "notice",
    feasibility: input.feasibility,
    end: null,
    goalId: input.goalId,
    notice: null,
    ownLevel: null,
    fitOffer: null,
    fundedMocks: [],
    phases: input.phases,
    planId: `plan-${input.goalId}`,
    ready: true,
    shortPlan: null,
    schedule: {
      dailyMinutes: input.minutes,
      dailyTimes: [15, 30, 45, 60, 90, 120],
      fullCourse: false,
      lightWeeks: [],
      mocks: null,
      studyDays: weekdayMinutes.filter((m) => m > 0).length,
      noticeDay: null,
      noSitting: null,
      nextSitting: null,
      targetDate: input.targetDate,
      targetDateEstimated: false,
      targetDateNamedMonth: false,
      weekdayMinutes,
      shape: {
        canDiffer: true,
        weekdayDays: [1, 2, 3, 4, 5],
        weekdays: input.minutes,
        weekend: input.weekends ? null : null,
        weekendDays: [0, 6],
      },
    },
    status: { kind: "onTrack" },
    steering: {
      difficultyBias: "standard",
      lessonsStudied: 0,
      practiceBias: "balanced",
      skippedActivities: [],
    },
    tools: input.tools ?? [],
    week: buildWeek({ minutes: input.minutes, weekends: input.weekends }),
    weekTime: {
      studiedMinutes: 0,
      targetMinutes: input.minutes * weekdayMinutes.filter((m) => m > 0).length,
    },
    writtenPractice: null,
  };
}

// ---------- Career goal (dated, modules) ----------

/** Lessons each in-plan module teaches at 1 hr a day, and how many weekdays it takes. */
const CAREER_LESSONS = [8, 14, 18, 12, 12, 0, 9, 7];

export function careerPlan(lang: "en" | "pt", tools?: PlanView["tools"]) {
  const career = S(lang).career;
  let start = TODAY;
  let index = 0;

  const phases = career.modules.map((module, position) => {
    const lessons = CAREER_LESSONS[position] ?? 8;

    if (!module.inPlan) {
      return phase({
        chapterCount: 0,
        chapters: [],
        hours: 0,
        index: position,
        name: module.name,
        state: "leftOut",
      });
    }

    // Spread the in-plan modules over the 181 days to the date, by lessons.
    const days = Math.round((lessons / 80) * 181);
    const startDate = start;
    const endDate = position === career.modules.length - 1 ? career.date : addDays(start, days - 1);
    start = addDays(endDate, 1);
    const current = index === 0;
    index += 1;

    return phase({
      chapters: [
        chapter({
          lessonsTotal: lessons,
          nextDate: current ? TODAY : startDate,
          state: current ? "current" : "upcoming",
          title: module.name,
        }),
      ],
      endDate,
      hours: lessons,
      index: position,
      lessonsTotal: lessons,
      name: module.name,
      startDate,
      state: current ? "current" : "upcoming",
    });
  });

  return basePlan({
    endDate: career.date,
    feasibility: {
      coreFits: true,
      coveredShare: career.coverage,
      deadline: career.date,
      deepensMostAsked: false,
      fits: false,
      measure: "goal",
      timeCovers: false,
    },
    goalId: CAREER_GOAL_ID,
    minutes: career.minutesPerDay,
    phases,
    targetDate: career.date,
    tools,
    totalHours: 210,
    weekends: false,
  });
}

export function careerSyllabus(lang: "en" | "pt"): SyllabusView {
  const career = S(lang).career;

  const subjects: SyllabusSubject[] = career.modules.map((module, position) => {
    const lessons = module.inPlan ? (CAREER_LESSONS[position] ?? 8) : 0;

    return {
      areas: [module.name],
      chapters: [],
      displayWeight: null as any,
      group: null,
      imageUrl: null,
      key: slug(module.name),
      lessonsDone: 0,
      lessonsKnown: 0,
      lessonsTotal: lessons,
      mastery: null,
      matrix: [],
      name: module.name,
      nextDate: module.inPlan ? (position === 0 ? TODAY : null) : null,
      notPlannedReason: module.inPlan ? null : "time",
      preparation: null,
      questions: null,
      share: null,
      shortName: module.name,
      source: "plan",
      topicFrequencySource: null,
      topics: [],
      topicsKnown: null,
      topicsStudied: null,
    };
  });

  const total = subjects.reduce((sum, subject) => sum + subject.lessonsTotal, 0);

  return {
    courseWeights: null,
    examDocument: "notice",
    fromMaterial: false,
    goal: { id: CAREER_GOAL_ID, kind: "learn", title: career.title },
    kind: "modules",
    knownTopicsReturn: "practice",
    lessons: { done: 0, known: 0, total },
    noticeUrl: null,
    passMarks: null,
    questionsSource: null,
    subjects,
    topicCount: 0,
    topicsMapped: false,
    writtenPractice: null,
  };
}

// ---------- Learn goal (no date, one course path) ----------

function learnPlan(lang: "en" | "pt") {
  const learn = S(lang).learn;
  const dates = [
    ["2026-10-06", "2026-10-20"],
    ["2026-10-21", "2026-11-10"],
    ["2026-11-11", "2026-12-04"],
    ["2026-12-05", "2027-06-18"],
  ];

  const phases = learn.chapters.map(([title, counts], position) => {
    const [done, total] = counts.split("/").map((part) => Number(part.trim())) as [number, number];
    const state = done >= total ? "done" : position === 1 ? "current" : "upcoming";
    const [startDate, endDate] = dates[position] ?? [null, null];

    return phase({
      chapters: [
        chapter({
          lessonsDone: done,
          lessonsTotal: total,
          nextDate: state === "current" ? TODAY : state === "upcoming" ? startDate : null,
          state,
          title,
        }),
      ],
      endDate,
      hours: total,
      index: position,
      lessonsDone: done,
      lessonsTotal: total,
      name: title,
      startDate,
      state,
    });
  });

  return basePlan({
    endDate: "2027-06-18",
    feasibility: null,
    goalId: LEARN_GOAL_ID,
    minutes: 30,
    phases,
    targetDate: null,
    totalHours: 40,
    weekends: true,
  });
}

// ---------- Screen wiring ----------

export const ACTIONS = {
  adviseOnBases: async () => null,
  change: async () => null,
  chooseExamOption: async () => null,
  chooseTools: async () => true as const,
  decide: async () => true,
  findTimeToCover: async () => null,
  preview: async () => null,
};

const LINKS: JourneyLinks = {
  challenge: (id) => `/challenge/${id}`,
  chapter: (id) => `/content/chapters/${id}`,
  completedLessons: null,
  course: () => "/courses",
  exam: null,
  focusTest: "/focus-test",
  logbook: "/logbook",
  mindMaps: null,
  subject: (key) => `/plan/${key}`,
};

function standingFor(lessons: SyllabusView["lessons"] | null): JourneyStanding {
  return {
    forExam: false,
    kind: "preparation",
    lessons,
    preparation: { value: 0, weekGain: 0 } as any,
    stillNeeded: [] as any,
  };
}

/**
 * Scrolls the page once it has drawn: `scroll=<px>`, or `at=modules|path` to put that section 16px
 * from the top (the same framing in every language). `inside=1` scrolls the open sheet instead.
 */
function useScrollParam(q: URLSearchParams) {
  useEffect(() => {
    const at = q.get("at");
    if (at) {
      const timer = setTimeout(() => {
        const slot = at === "modules" ? "syllabus" : "journey-path-list";
        const target = document.querySelector<HTMLElement>(`[data-slot=${slot}]`);
        const section = at === "modules" ? target : target?.closest("section");
        if (section) window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - 16);
      }, 250);
      return () => clearTimeout(timer);
    }
    const scroll = Number(q.get("scroll") ?? 0);
    if (!scroll) return;
    const timer = setTimeout(() => {
      const sheet = document.querySelector<HTMLElement>("[data-slot=drawer-content]");
      if (q.get("inside") && sheet) sheet.scrollTop = scroll;
      else window.scrollTo(0, scroll);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
}

function TutorLink({
  children,
  href,
  className,
}: {
  children?: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

/** A pushed page under the Plan tab: no top bar, the tab bar stays. */
function PushedShell({ children }: { children: ReactNode }) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <LearnShell className="overflow-x-clip">
        <LearnShellContent>
          <LearnShellMain>{children}</LearnShellMain>
          <LearnBottomNavigation activeTab="journey" buddy={ZU} missions={{ done: 1, total: 3 }} />
        </LearnShellContent>
      </LearnShell>
    </LearnProvider>
  );
}

function CareerModulePage({ lang }: { lang: "en" | "pt" }) {
  const syllabus = careerSyllabus(lang);
  const subject = syllabus.subjects.find((s) => s.notPlannedReason !== null)!;
  const target = useMemo(
    () => ({ goalId: CAREER_GOAL_ID, kind: "subject" as const, subjectKey: subject.key }),
    [subject.key],
  );
  const tutor = useMemo(
    () => ({
      buddy: ZU,
      canAsk: true,
      connection: { apiUrl: "/__no-tutor", getHeaders: async () => ({}) },
      navigation: {
        linkComponent: TutorLink as any,
        loginHref: "/login",
        subscriptionHref: "/subscription",
      },
    }),
    [],
  );

  return (
    <PushedShell>
      <SubjectScreen
        actions={{ restore: async () => true, setWrittenCadence: async () => true }}
        ask={{
          bar: <AskTutor size="bar" target={target} tutor={tutor} />,
          row: <AskTutor appearance="row" target={target} tutor={tutor} />,
        }}
        hrefs={{ adjust: "/plan", back: "/plan", chapter: (id) => `/content/chapters/${id}` }}
        subject={subject}
        syllabus={syllabus}
      />
    </PushedShell>
  );
}

function CareerPlan({
  lang,
  q,
  openAdjust = false,
  tools,
}: ViewProps & { openAdjust?: boolean; tools?: PlanView["tools"] }) {
  const career = S(lang).career;
  const syllabus = careerSyllabus(lang);
  useScrollParam(q);

  return (
    <TabShell
      goal={{
        dailyMinutes: career.minutesPerDay,
        id: CAREER_GOAL_ID,
        kind: "learn",
        targetDate: career.date,
        title: career.title,
      }}
      tab="journey"
    >
      <JourneyScreen
        actions={ACTIONS as any}
        goal={{ kind: "learn", title: career.title }}
        goalStatus={{ onSetStatus: async () => "saved", resume: false, status: "active" } as any}
        links={LINKS}
        openAdjust={openAdjust}
        plan={careerPlan(lang, tools)}
        refresh={() => {}}
        shareHref="/plan-link/plan"
        standing={standingFor(syllabus.lessons)}
        syllabus={toSyllabusSection(syllabus)}
        tutor={{ buddy: ZU, href: "/buddy" }}
      />
    </TabShell>
  );
}

function PlanCareerView(props: ViewProps) {
  if (props.state === "module") return <CareerModulePage lang={props.lang} />;
  return <CareerPlan {...props} />;
}

function PlanLearnView({ lang, q, state }: ViewProps) {
  const learn = S(lang).learn;
  useScrollParam(q);
  useScript(async () => {
    if (state !== "adjust") return;
    await waitFor(() => document.querySelector("[data-slot=drawer-popup]"));
    await pause(300);
    dropFocusRing();
  });

  return (
    <TabShell
      goal={{
        dailyMinutes: 30,
        id: LEARN_GOAL_ID,
        kind: "learn",
        targetDate: null,
        title: learn.title,
      }}
      tab="journey"
    >
      <JourneyScreen
        actions={ACTIONS as any}
        goal={{ kind: "learn", title: learn.title }}
        goalStatus={{ onSetStatus: async () => "saved", resume: false, status: "active" } as any}
        links={LINKS}
        openAdjust={state === "adjust"}
        plan={learnPlan(lang)}
        refresh={() => {}}
        shareHref="/plan-link/plan"
        standing={standingFor({ done: 4, known: 0, total: 19 })}
        syllabus={null}
        tutor={{ buddy: ZU, href: "/buddy" }}
      />
    </TabShell>
  );
}

/** Waits for an element, then runs a step; steps run in order, as a learner's taps would. */
function waitFor<T extends Element>(find: () => T | null | undefined, timeout = 3000): Promise<T> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const found = find();
      if (found) return resolve(found);
      if (Date.now() - started > timeout) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 50);
    };
    tick();
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A tap leaves no focus ring: drop the one programmatic focus draws. */
function dropFocusRing() {
  (document.activeElement as HTMLElement | null)?.blur?.();
}

function useScript(script: () => Promise<void>) {
  useEffect(() => {
    void script()
      .catch((error) => console.error(error))
      .finally(() => {
        (window as any).__scripted = true;
      });
  }, []);
}

const PICKS = { have: 0, none: 2, setup: 1 } as const;
const SYSTEMS = { chromebook: 3, linux: 2, macos: 1, phone: 4, windows: 0 } as const;

/**
 * The tool choice the plan offers for each tool it uses (Adjust plan → "You'll use"):
 * `state=list` shows the tools, `state=chosen` the tools once answered, `state=sheet` (default) opens the first tool's "How will you use it?",
 * `pick=have|setup|none` picks an answer, `system=windows|macos|linux|chromebook|phone` the device for setup,
 * `tool=<n>` which tool (0-based).
 */
function ToolsView(props: ViewProps) {
  const career = S(props.lang).career;
  const { q, state } = props;

  // `state=chosen`: after the learner answered: the spreadsheet they have, SQL set up on Windows.
  const chosen = state === "chosen";
  const tools: PlanView["tools"] = career.tools.map((name, index) => ({
    choice: chosen && index === 0 ? "have" : chosen && index === 1 ? "setup" : null,
    essential: index < 2,
    later: index === career.tools.length - 1,
    name,
    system: chosen && index === 1 ? "windows" : null,
  }));

  useScript(async () => {
    const title = await waitFor(() => document.getElementById("plan-tools-title"));
    await pause(300);
    const content = title.closest<HTMLElement>("[data-slot=drawer-content]");
    if (content) {
      content.scrollTop +=
        title.getBoundingClientRect().top - content.getBoundingClientRect().top - 8;
    }
    dropFocusRing();

    if (state === "list" || state === "chosen") return;

    const section = title.closest("section")!;
    const index = Number(q.get("tool") ?? 0);
    const buttons = [...section.querySelectorAll<HTMLButtonElement>("li button")];

    if (index >= 2) section.querySelector<HTMLElement>("summary")?.click();
    await pause(100);
    const rows = [...section.querySelectorAll<HTMLButtonElement>("li button")];
    (rows[index] ?? buttons[0])?.click();

    const sheet = await waitFor(() => {
      const popups = document.querySelectorAll("[data-slot=drawer-popup]");
      return popups.length > 1 ? popups[popups.length - 1] : null;
    });
    await pause(300);
    dropFocusRing();

    const pick = q.get("pick") as keyof typeof PICKS | null;
    if (!pick) return;

    const options = [...sheet.querySelectorAll<HTMLElement>("[role=radio]")];
    options[PICKS[pick]]?.click();
    await pause(150);

    const system = q.get("system") as keyof typeof SYSTEMS | null;
    if (pick === "setup" && system) {
      const toggles = [...sheet.querySelectorAll<HTMLButtonElement>("fieldset button")];
      toggles[SYSTEMS[system]]?.click();
      await pause(150);
    }

    dropFocusRing();
  });

  return <CareerPlan {...props} openAdjust tools={tools} />;
}

export const views: Record<string, (p: ViewProps) => any> = {
  "plan-career": PlanCareerView,
  "plan-learn": PlanLearnView,
  tools: ToolsView,
};
