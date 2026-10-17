import {
  type ChapterScopeContext,
  type ExamFactsContext,
  type ItemScopeContext,
  type LessonScopeContext,
  type MockScopeContext,
  type PlanScopeContext,
  type SubjectScopeContext,
  type TutorScreenContext,
} from "../../lessons/lesson-question-context";

/** "2027-01-10" starts with its year. */
const YEAR_LENGTH = 4;

/** Every string in a value, however deep: a screen's content, in whatever shape. */
function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }

  return [];
}

/** An exam's names and the years of its days, as its notice gives them (the same for everyone). */
function examText(exam: ExamFactsContext): (string | null)[] {
  return [
    exam.name,
    ...exam.subjects.flatMap((subject) => [subject.name, subject.group]),
    ...[...exam.days, ...exam.otherDates].map((day) => day.date.slice(0, YEAR_LENGTH)),
  ];
}

function courseText(course: PlanScopeContext["course"]): (string | null)[] {
  if (!course) {
    return [];
  }

  return [course.title, course.description, ...course.levels.flatMap((level) => level.chapters)];
}

/** A lesson's text, never the learner's answer on it. */
function lessonText(screen: LessonScopeContext): (string | null)[] {
  return [
    screen.course.title,
    screen.course.description,
    screen.chapter.title,
    screen.chapter.description,
    screen.lesson.title,
    screen.lesson.description,
    ...collectStrings([screen.lessonSteps, screen.step]),
  ];
}

function chapterText(screen: ChapterScopeContext): (string | null)[] {
  return [
    screen.course?.title ?? null,
    screen.chapter.title,
    screen.chapter.description,
    ...screen.chapter.objectives,
    ...screen.lessons.flatMap((lesson) => [lesson.title, lesson.description, lesson.canDo]),
  ];
}

function subjectText(screen: SubjectScopeContext): string[] {
  return [
    screen.subject.name,
    ...screen.topics.map((topic) => topic.name),
    ...screen.chapters.map((chapter) => chapter.title),
  ];
}

/** A question as the learner saw it, never what they answered. */
function itemText(screen: ItemScopeContext): (string | null)[] {
  return [screen.question.text, ...screen.question.options, screen.set, screen.skill];
}

/** A mock's exam and the questions missed, never the learner's answers, results or dates. */
function mockText(screen: MockScopeContext): (string | null)[] {
  return [
    screen.exam.name,
    ...screen.areas.map((area) => area.name),
    ...screen.sections.map((section) => section.name),
    ...screen.missed.flatMap((missed) => [missed.question, missed.area, missed.skill]),
  ];
}

function screenText(screen: TutorScreenContext | undefined): (string | null)[] {
  if (!screen) {
    return [];
  }

  if ("lessonSteps" in screen) {
    return lessonText(screen);
  }

  if ("lessons" in screen) {
    return chapterText(screen);
  }

  if ("subject" in screen) {
    return subjectText(screen);
  }

  if ("question" in screen) {
    return itemText(screen);
  }

  return mockText(screen);
}

function isText(text: string | null): text is string {
  return Boolean(text);
}

/**
 * The Library's and the notice's text the learner asked about, the same for every learner who
 * reads it: an exam's names and days, the course's outline and the screen's content. It counts only
 * when the context says all of it is public (`privateContent: false`, an exam not read from their
 * material): text written for this learner alone, their own material, and a question saved before
 * that was marked are as personal as what they wrote. The goal, the plan, their mistakes and
 * answers always are.
 */
export function collectPublicText(context: PlanScopeContext): string[] {
  if (context.privateContent !== false || context.exam?.fromMaterial === true) {
    return [];
  }

  const exam = context.exam ? examText(context.exam) : [];
  const texts = [...exam, ...courseText(context.course), ...screenText(context.screen)];

  return texts.filter((text) => isText(text));
}
