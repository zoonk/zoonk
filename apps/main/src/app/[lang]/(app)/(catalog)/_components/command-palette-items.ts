import { type AppRoute } from "@/i18n/navigation";
import { type getMenu } from "@/lib/menu";
import { type ChapterSearchResult, type CourseSearchResult } from "@zoonk/core/catalog/search";
import { normalizeString } from "@zoonk/utils/string";
import {
  ArrowLeftRightIcon,
  BookOpenIcon,
  LayersIcon,
  LightbulbIcon,
  LogOutIcon,
  type LucideIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PlayIcon,
  PlusIcon,
  TimerIcon,
} from "lucide-react";

type PaletteRoute = AppRoute<ReturnType<typeof getMenu>["url"]>;

type PaletteRow = {
  chip?: string;
  count?: number;
  icon: LucideIcon;
  id: string;
  label: string;
  meta?: string;
  searchValue: string;
};

type NavigationPaletteItem = PaletteRow & { kind: "navigation"; url: PaletteRoute };

type LogoutPaletteItem = PaletteRow & { kind: "logout" };

type FeedbackPaletteItem = PaletteRow & { kind: "feedback" };

type GoalPaletteItem = PaletteRow & { goalId: string; kind: "goal" };

type ExplanationPaletteItem = PaletteRow & { goalId: string; kind: "explanation" };

type ContinuePaletteItem = PaletteRow & { kind: "continue"; sessionId: string };

type AskPaletteItem = PaletteRow & { kind: "ask"; question: string };

type StartGoalPaletteItem = PaletteRow & { kind: "startGoal"; prompt: string };

type SubjectPaletteItem = PaletteRow & { kind: "subject"; subjectKey: string };

type PlanChapterPaletteItem = PaletteRow & {
  chapterId: string;
  kind: "planChapter";
  unit: boolean;
};

type MockPaletteItem = PaletteRow & { blockId: string; kind: "mockResult" };

export type CoursePaletteItem = {
  course: CourseSearchResult;
  id: string;
  kind: "course";
  label: string;
  searchValue: string;
};

export type ChapterPaletteItem = {
  chapter: ChapterSearchResult;
  id: string;
  kind: "chapter";
  label: string;
  searchValue: string;
};

export type PaletteItem =
  | AskPaletteItem
  | ChapterPaletteItem
  | ContinuePaletteItem
  | CoursePaletteItem
  | ExplanationPaletteItem
  | FeedbackPaletteItem
  | GoalPaletteItem
  | LogoutPaletteItem
  | MockPaletteItem
  | NavigationPaletteItem
  | PlanChapterPaletteItem
  | StartGoalPaletteItem
  | SubjectPaletteItem;

export type PaletteGroup = { id: string; items: PaletteItem[]; label: string };

export function createNavigationPaletteItem({
  id,
  keywords,
  label,
  menu,
  ...extras
}: Pick<PaletteRow, "chip" | "count" | "meta"> & {
  id: string;
  keywords?: string;
  label: string;
  menu: { icon: LucideIcon; url: PaletteRoute };
}): NavigationPaletteItem {
  return {
    ...extras,
    icon: menu.icon,
    id,
    kind: "navigation",
    label,
    searchValue: [label, keywords].filter(Boolean).join(" "),
    url: menu.url,
  };
}

export function createLogoutPaletteItem({ label }: { label: string }): LogoutPaletteItem {
  return { icon: LogOutIcon, id: "logout", kind: "logout", label, searchValue: label };
}

export function createFeedbackPaletteItem({ label }: { label: string }): FeedbackPaletteItem {
  return {
    icon: MessageSquareIcon,
    id: "send-feedback",
    kind: "feedback",
    label,
    searchValue: label,
  };
}

export function createGoalPaletteItem({
  goalId,
  label,
}: {
  goalId: string;
  label: string;
}): GoalPaletteItem {
  return {
    goalId,
    icon: ArrowLeftRightIcon,
    id: `goal-${goalId}`,
    kind: "goal",
    label,
    searchValue: label,
  };
}

export function createExplanationPaletteItem({
  goalId,
  title,
}: {
  goalId: string;
  title: string;
}): ExplanationPaletteItem {
  return {
    goalId,
    icon: LightbulbIcon,
    id: `explanation-${goalId}`,
    kind: "explanation",
    label: title,
    searchValue: title,
  };
}

export function createContinuePaletteItem({
  label,
  meta,
  sessionId,
}: {
  label: string;
  meta: string;
  sessionId: string;
}): ContinuePaletteItem {
  return {
    icon: PlayIcon,
    id: "continue",
    kind: "continue",
    label,
    meta,
    searchValue: label,
    sessionId,
  };
}

export function createAskPaletteItem({
  label,
  meta,
  question,
}: {
  label: string;
  meta?: string;
  question: string;
}): AskPaletteItem {
  return {
    icon: MessageCircleIcon,
    id: question ? "ask-question" : "ask",
    kind: "ask",
    label,
    meta,
    question,
    searchValue: label,
  };
}

export function createStartGoalPaletteItem({
  label,
  prompt,
}: {
  label: string;
  prompt: string;
}): StartGoalPaletteItem {
  return {
    icon: PlusIcon,
    id: "start-goal-prompt",
    kind: "startGoal",
    label,
    prompt,
    searchValue: label,
  };
}

export function createSubjectPaletteItem(subject: {
  key: string;
  name: string;
  shortName: string;
}): SubjectPaletteItem {
  return {
    icon: LayersIcon,
    id: `subject-${subject.key}`,
    kind: "subject",
    label: subject.name,
    searchValue: [subject.name, subject.shortName].join(" "),
    subjectKey: subject.key,
  };
}

/** Two subjects can have chapters of the same name. */
export function createPlanChapterPaletteItem(chapter: {
  chapterId: string;
  subject: string;
  title: string;
  unit: boolean;
}): PlanChapterPaletteItem {
  return {
    chapterId: chapter.chapterId,
    icon: BookOpenIcon,
    id: `plan-chapter-${chapter.chapterId}`,
    kind: "planChapter",
    label: chapter.title,
    meta: chapter.subject,
    searchValue: [chapter.title, chapter.subject].join(" "),
    unit: chapter.unit,
  };
}

export function createMockPaletteItem({
  blockId,
  label,
}: {
  blockId: string;
  label: string;
}): MockPaletteItem {
  return {
    blockId,
    icon: TimerIcon,
    id: `mock-${blockId}`,
    kind: "mockResult",
    label,
    searchValue: label,
  };
}

export function createCoursePaletteItem(course: CourseSearchResult): CoursePaletteItem {
  return {
    course,
    id: `course-${course.id}`,
    kind: "course",
    label: course.title,
    searchValue: [course.title, course.description, course.id].filter(Boolean).join(" "),
  };
}

/** Chapter titles are often reused across courses, so the search value includes the parent course. */
export function createChapterPaletteItem(chapter: ChapterSearchResult): ChapterPaletteItem {
  return {
    chapter,
    id: `chapter-${chapter.id}`,
    kind: "chapter",
    label: chapter.title,
    searchValue: [chapter.title, chapter.courseTitle, chapter.description, chapter.id]
      .filter(Boolean)
      .join(" "),
  };
}

export function getVisiblePaletteGroups({
  groups,
  query,
}: {
  groups: PaletteGroup[];
  query: string;
}) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        matchesPaletteSearch({ query, value: getPaletteItemSearchValue(item) }),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/** A command's detail describes its destination: searching the next block's name must keep Continue available. */
export function getPaletteItemSearchValue(item: PaletteItem) {
  return [item.searchValue, "meta" in item ? item.meta : undefined].filter(Boolean).join(" ");
}

/** Accent-insensitive, as the server searches the learner's own plan. */
export function matchesPaletteSearch({ query, value }: { query: string; value: string }) {
  const normalizedQuery = normalizePaletteSearchText(query.trim());

  if (!normalizedQuery) {
    return true;
  }

  return normalizePaletteSearchText(value).includes(normalizedQuery);
}

function normalizePaletteSearchText(value: string) {
  return normalizeString(value);
}
