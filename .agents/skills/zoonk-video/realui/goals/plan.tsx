import { type SyllabusView } from "@repo/packages/core/src/view-models/syllabus/syllabus-contract.ts";
// The exam goal's Plan tab, built from story.exam.
import { JourneyScreen } from "@repo/packages/learn/src/journey/journey-screen.tsx";
import { getPlanTopics } from "@repo/packages/learn/src/journey/preparation/study-counts.ts";
import { type ComponentProps, useEffect } from "react";
import { actions } from "../learn/common";
import { preparationAt } from "../learn/plan";
import { story, type Lang } from "../story";
import { AppFrame, NOOP } from "./shell";

type Props = ComponentProps<typeof JourneyScreen>;

const TODAY = "2026-11-03";
const WEEK = [
  "2026-11-01",
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
];

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Phase = Props["plan"]["phases"][number];

function phase(
  index: number,
  kind: Phase["kind"],
  state: Phase["state"],
  startDate: string,
  endDate: string,
  done: number,
  total: number,
): Phase {
  return {
    challengeLeftOut: false,
    chapterCount: 6,
    chapters: [],
    checkpoint: {
      date: endDate,
      locked: false,
      planItemId: `boss-${index}`,
      state: "upcoming",
      when: "date",
    },
    endDate,
    hours: 20,
    index,
    kind,
    lessonsDone: done,
    lessonsTotal: total,
    milestone: null,
    mocks: { count: 0, nextDate: null },
    name: "",
    notPlannedReason: null,
    short: null,
    startDate,
    state,
  };
}

export function examPlanView(lang: Lang): Props["plan"] {
  const exam = story[lang].exam;
  const date = exam.date;
  const span = Math.round((new Date(date).getTime() - new Date(TODAY).getTime()) / 86400000);
  const q = Math.round(span / 4);

  return {
    access: { mocksRequirePlus: false },
    areas: exam.subjects.map((subject) => ({
      focusPart: null,
      focused: false,
      name: subject.name,
      partOf: null,
      pastBasics: false,
      reduced: false,
      skillCount: 12,
      skipped: false,
    })),
    bases: null,
    changes: [],
    course: null,
    currentPhase: 0,
    estimate: {
      endDate: date,
      fullCourseEndDate: null,
      pace: null,
      remainingHours: 90,
      totalHours: 104,
    },
    numbers: null,
    examChoices: [],
    examDocument: "notice",
    focusTest: null,
    feasibility: {
      coreFits: true,
      coveredShare: exam.coverage,
      deadline: date,
      deepensMostAsked: true,
      fits: false,
      measure: "exam",
      timeCovers: false,
    },
    end: null,
    goalId: "exam",
    languageAim: null,
    notice: null,
    ownLevel: null,
    fitOffer: null,
    fundedMocks: [],
    phases: [
      phase(0, "foundations", "current", "2026-10-20", addDays(TODAY, q), 9, 40),
      phase(1, "gaps", "upcoming", addDays(TODAY, q + 1), addDays(TODAY, 2 * q), 0, 36),
      phase(2, "practice", "upcoming", addDays(TODAY, 2 * q + 1), addDays(TODAY, 3 * q), 0, 30),
      phase(3, "finalStretch", "upcoming", addDays(TODAY, 3 * q + 1), date, 0, 14),
    ],
    planId: "plan",
    ready: true,
    shortPlan: null,
    schedule: {
      dailyMinutes: exam.minutesPerDay,
      dailyTimes: [15, 30, 45, 60],
      fullCourse: false,
      lightWeeks: [],
      mocks: null,
      studyDays: 5,
      noticeDay: null,
      noSitting: null,
      nextSitting: null,
      targetDate: date,
      targetDateEstimated: false,
      targetDateNamedMonth: false,
      weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
      shape: {
        canDiffer: true,
        weekdayDays: [1, 2, 3, 4, 5],
        weekdays: exam.minutesPerDay,
        weekend: null,
        weekendDays: [0, 6],
      },
    },
    status: { kind: "onTrack" },
    steering: {
      difficultyBias: "standard",
      lessonsStudied: 9,
      practiceBias: "balanced",
      skippedActivities: [],
    },
    suggestedTime: null,
    tools: [],
    week: {
      days: WEEK.map((day) => ({
        date: day,
        items: [],
        minutes: 45,
        mockFunding: null,
        state:
          day < TODAY ? (day === WEEK[0] ? "rest" : "done") : day === TODAY ? "today" : "upcoming",
        study: {
          completed: day === WEEK[1] ? 3 : 0,
          date: day,
          goalMinutes: day === WEEK[0] || day === WEEK[6] ? 0 : exam.minutesPerDay,
          hitGoal: day === WEEK[1],
          isToday: day === TODAY,
          kind: day === WEEK[0] || day === WEEK[6] ? "rest" : "study",
          minutes: day === WEEK[1] ? 52 : 0,
          studied: day === WEEK[1],
          total: day === WEEK[1] ? 3 : 0,
        },
      })),
      endDate: "2026-11-07",
      startDate: "2026-11-01",
    },
    weekTime: { studiedMinutes: 52, targetMinutes: 225 },
    writtenPractice: null,
  };
}

export function examSyllabus(lang: Lang): SyllabusView {
  const exam = story[lang].exam;

  return {
    courseWeights: null,
    examDocument: "notice",
    fromMaterial: false,
    hasNotice: true,
    goal: { displayName: exam.title, id: "exam", kind: "exam", title: exam.title },
    kind: "notice",
    knownTopicsReturn: "practice",
    lessons: { done: 14, known: 2, total: 120 },
    noticeUrl: null,
    passMarks: null,
    questionsSource: null,
    sharedExams: [],
    subjects: exam.subjects.map((subject) => ({
      areas: [subject.name],
      chapters: [],
      covers: [],
      displayWeight: null,
      group: null,
      imageUrl: null,
      key: slug(subject.name),
      lessonsDone: Math.round(subject.progress * 60),
      lessonsKnown: 0,
      lessonsTotal: 60,
      mastery: { answered: 8, correct: 6 },
      matrix: [],
      name: subject.name,
      nextDate: "2026-11-04",
      notPlannedReason: null,
      preparation: subject.progress,
      questions: null,
      share: 1 / exam.subjects.length,
      sharedWith: [],
      shortName: subject.name,
      source: "notice",
      topicFrequencySource: null,
      topics: [],
      topicsKnown: 0,
      topicsStudied: 2,
    })),
    topicCount: 0,
    topicsMapped: true,
    writtenPractice: null,
  };
}

/** Taps the first element matching `selector` once the screen has painted (opens a sheet for a still). */
export function useTapOnMount(selector: string | null, delay = 300) {
  useEffect(() => {
    if (!selector) return;
    const timer = setTimeout(() => document.querySelector<HTMLElement>(selector)?.click(), delay);
    return () => clearTimeout(timer);
  }, [selector, delay]);
}

export function ExamPlan({ lang, state }: { lang: Lang; state?: string }) {
  const exam = story[lang].exam;
  useTapOnMount(state === "coverage" ? '[data-slot="suggestion"] button' : null);
  const plan = examPlanView(lang);
  const syllabus = examSyllabus(lang);

  return (
    <AppFrame goal="exam" lang={lang} tab="journey">
      <JourneyScreen
        actions={actions<Props["actions"]>({})}
        end={{ certificates: null, next: null }}
        goal={{ displayName: exam.title, kind: "exam" }}
        goalStatus={{ onSetStatus: async () => "saved", resume: false, status: "active" }}
        links={{
          challenge: (id: string) => `/challenge/${id}`,
          chapter: (id: string) => `/content/chapters/${id}`,
          completedLessons: null,
          course: () => "/course",
          exam: "/exam",
          focusTest: "/focus-test",
          levelTest: "/level-test",
          logbook: "/logbook",
          mindMaps: null,
          placementTest: "/placement-test",
          subject: (key: string) => `/plan/${key}`,
        }}
        plan={plan}
        refresh={NOOP}
        shareHref="/plan-link/plan"
        standing={{
          forExam: true,
          kind: "preparation",
          lessons: syllabus.lessons,
          preparation: preparationAt({ goalId: "exam", value: exam.preparation, weekGain: 0.03 }),
          stillNeeded: { areas: [], left: 0, minutes: 0, rule: "examWeighted" },
          topics: getPlanTopics(syllabus),
        }}
        syllabus={syllabus}
        tutor={{ buddy: { kind: "zu", name: null }, href: "/buddy" }}
      />
    </AppFrame>
  );
}
