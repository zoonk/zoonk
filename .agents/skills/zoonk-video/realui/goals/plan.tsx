// The exam goal's Plan tab, built from story.exam.
import { JourneyScreen } from "@repo/packages/learn/src/journey/journey-screen.tsx";
import { useEffect } from "react";
import { story, type Lang } from "../story";
import { AppFrame, NOOP, NOOP_ASYNC } from "./shell";

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

function phase(
  index: number,
  kind: string,
  state: string,
  startDate: string,
  endDate: string,
  done: number,
  total: number,
) {
  return {
    challengeLeftOut: false,
    chapterCount: 6,
    chapters: [],
    checkpoint: {
      date: endDate,
      locked: false,
      planItemId: `boss-${index}`,
      state: "upcoming",
      when: "later",
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
    short: null,
    startDate,
    state,
  };
}

export function examPlanView(lang: Lang) {
  const exam = story[lang].exam;
  const date = exam.date;
  const span = Math.round((new Date(date).getTime() - new Date(TODAY).getTime()) / 86400000);
  const q = Math.round(span / 4);

  return {
    access: { freeUntil: null, freeWeekOver: false, mocksRequirePlus: false },
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
      shape: "weekdays",
    },
    status: { kind: "onTrack" },
    steering: {
      difficultyBias: "standard",
      lessonsStudied: 9,
      practiceBias: "balanced",
      skippedActivities: [],
    },
    tools: [],
    week: {
      days: WEEK.map((day) => ({
        date: day,
        items: [],
        minutes: 45,
        mockFunding: null,
        state:
          day < TODAY ? (day === WEEK[0] ? "rest" : "done") : day === TODAY ? "today" : "upcoming",
      })),
      endDate: WEEK[6],
      startDate: WEEK[0],
    },
    weekTime: { goalMinutes: 225, studiedMinutes: 52 },
    writtenPractice: null,
  } as any;
}

export function examSyllabus(lang: Lang) {
  const exam = story[lang].exam;

  return {
    courseWeights: null,
    examDocument: "notice",
    fromMaterial: false,
    goal: { id: "exam", kind: "exam", title: exam.title },
    kind: "notice",
    knownTopicsReturn: "practice",
    lessons: { done: 14, known: 2, total: 120 },
    noticeUrl: null,
    passMarks: null,
    questionsSource: null,
    subjects: exam.subjects.map((subject) => ({
      areas: [subject.name],
      chapters: [],
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
  } as any;
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
        actions={{
          adviseOnBases: NOOP_ASYNC,
          change: NOOP_ASYNC,
          chooseExamOption: NOOP_ASYNC,
          chooseTools: NOOP_ASYNC,
          decide: NOOP_ASYNC,
          findTimeToCover: NOOP_ASYNC,
          preview: NOOP_ASYNC,
        }}
        goal={{ kind: "exam", title: exam.title }}
        goalStatus={{ onSetStatus: NOOP_ASYNC, resume: false, status: "active" } as any}
        links={
          {
            challenge: (id: string) => `/challenge/${id}`,
            chapter: (id: string) => `/content/chapters/${id}`,
            completedLessons: null,
            course: () => "/course",
            exam: "/exam",
            focusTest: "/focus-test",
            logbook: "/logbook",
            mindMaps: null,
            subject: (key: string) => `/plan/${key}`,
          } as any
        }
        plan={plan}
        refresh={NOOP}
        shareHref="/plan-link/plan"
        standing={{
          forExam: true,
          kind: "preparation",
          lessons: syllabus.lessons,
          preparation: {
            areas: [],
            components: {},
            estimatedScore: null,
            goalId: "exam",
            sections: [],
            skills: {},
            stage: "learning",
            status: null,
            value: exam.preparation,
            weakestAreaId: null,
            weekGain: 0.03,
          } as any,
          stillNeeded: { areas: [], left: 0, minutes: 0, rule: "examWeighted" },
        }}
        syllabus={syllabus}
        tutor={{ buddy: { kind: "zu", name: null }, href: "/buddy" }}
      />
    </AppFrame>
  );
}
