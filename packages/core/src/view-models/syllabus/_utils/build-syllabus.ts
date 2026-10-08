import { findNextItem } from "../../../plans/_utils/plan-phase-views";
import { type SyllabusSubject, type SyllabusView } from "../syllabus-contract";
import {
  buildChapters,
  getChapterKeyOf,
  getEarliestTodoDate,
  getItemAreas,
  isFinished,
  withoutKey,
} from "./syllabus-chapters";
import { type SyllabusInput } from "./syllabus-input";
import { draftSubjects, getShortName, listAreas, toKeys } from "./syllabus-subjects";
import {
  buildTopic,
  getNotPlannedReason,
  namesAnyTopic,
  withHeadingStatuses,
} from "./syllabus-topics";

/** An item standing in for a skill's lessons not written yet: no lesson, no chapter, its skill. */
function isStandIn(item: SyllabusInput["items"][number]): boolean {
  return item.kind === "lesson" && !item.lessonId && !item.chapterId && Boolean(item.skillId);
}

/**
 * How many lessons each plan item is: one for a lesson, and for an item standing in for a skill's
 * lessons not written yet, what the graph sizes the skill at less its lessons already in the plan
 * (at least one). A module whose lessons aren't written yet read "0 of 6 lessons" while it plans
 * 176, next to a written module's 169.
 */
function countItemLessons({
  items,
  skills,
}: {
  items: SyllabusInput["items"];
  skills: SyllabusInput["skills"];
}): (item: SyllabusInput["items"][number]) => number {
  const sizes = new Map(skills.map((skill) => [skill.skillId, skill.lessons ?? 1]));

  const written = Map.groupBy(
    items.filter((item) => item.lessonId && item.skillId),
    (item) => item.skillId ?? "",
  );

  return (item) =>
    isStandIn(item)
      ? Math.max(
          1,
          (sizes.get(item.skillId ?? "") ?? 1) - (written.get(item.skillId ?? "")?.length ?? 0),
        )
      : 1;
}

/**
 * A goal's structure in the learner's terms: an exam's notice subjects with their topics in its
 * own words and order (grouped as the notice groups them), each with progress from the plan's
 * lessons and when the plan studies it next; or the plan's modules with their chapters. Topics get
 * a status only when the plan's skills say which topics they teach; otherwise they're listed as
 * the notice has them, so nothing is claimed that the plan can't back.
 */
export function buildSyllabus(input: SyllabusInput): Omit<SyllabusView, "goal"> {
  const { areaCourses, chapterTitles, items, notice, pastBasicsSkillIds, skills, skippedAreas } =
    input;

  const areas = listAreas(skills);
  const { drafts, kind } = draftSubjects({ areas, notice });
  const mapped = kind === "notice" && skills.some((skill) => skill.topics.length > 0);
  const itemArea = getItemAreas({ items, skills });
  const skillNames = new Map(skills.map((skill) => [skill.skillId, skill.name]));
  const chapterKeyOf = getChapterKeyOf(items);
  const next = findNextItem(items);
  const nextKey = next ? chapterKeyOf(next) : null;
  const keys = toKeys(drafts.map((draft) => draft.name));
  const lessonsOf = countItemLessons({ items, skills });
  const sumLessons = (list: typeof items) => list.reduce((sum, item) => sum + lessonsOf(item), 0);

  const subjects = drafts.map((draft, index): SyllabusSubject => {
    const own = items.filter((item) => draft.areas.includes(itemArea(item) ?? ""));

    const chapters = buildChapters({
      chapterKeyOf,
      chapterTitles,
      items: own,
      nextKey,
      skillNames,
    });

    const skipped =
      draft.areas.length > 0 && draft.areas.every((area) => skippedAreas.includes(area));

    const ownSkills = skills.filter((skill) => draft.areas.includes(skill.area));

    // A subject the plan teaches whose current topics its skills don't name was planned from an
    // earlier reading of the notice: its topics show without a status, never all "not in the plan".
    const subjectMapped =
      mapped && (ownSkills.length === 0 || namesAnyTopic({ skills, topics: draft.topics }));

    const built = draft.topics.map((topic) => ({
      ...buildTopic({
        chapterKeyOf,
        chapters,
        items: { all: items, own },
        mapped: subjectMapped,
        pastBasicsSkillIds,
        skills: { all: skills, own: ownSkills },
        skipped,
        topic,
      }),
      frequency: draft.topicFrequency?.get(topic) ?? null,
      heading: draft.topicHeadings?.get(topic) ?? null,
    }));

    const topics = withHeadingStatuses(built);

    return {
      areas: draft.areas,
      chapters: chapters.map((chapter) => withoutKey(chapter)),
      group: draft.group,
      imageUrl: draft.areas.map((area) => areaCourses.get(area)?.imageUrl).find(Boolean) ?? null,
      key: keys[index] ?? draft.name,
      lessonsDone: sumLessons(own.filter((item) => isFinished(item.status))),
      lessonsTotal: sumLessons(own),
      matrix: [...(draft.matrix ?? [])],
      name: draft.name,
      nextDate: getEarliestTodoDate(own),
      notPlannedReason: getNotPlannedReason({
        hasItems: own.length > 0,
        hasSkills: ownSkills.length > 0,
        skipped,
      }),
      questions: draft.questions,
      share: draft.share,
      shortName: getShortName({ areaCourses, draft }),
      source: draft.source,
      topicFrequencySource: draft.frequencySource ?? null,
      topics,
      topicsStudied: subjectMapped
        ? topics.filter((topic) => topic.status === "studied").length
        : null,
    };
  });

  const fromNotice = kind === "notice" ? notice : null;

  return {
    courseWeights: fromNotice?.courseWeights ?? null,
    fromMaterial: fromNotice?.fromMaterial ?? false,
    kind,
    noticeUrl: fromNotice?.url ?? null,
    passMarks: [...(fromNotice?.passMarks ?? [])],
    questionsSource: fromNotice?.questionsSource ?? null,
    subjects,
    topicCount: subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
    topicsMapped: mapped,
    writtenPractice: input.writtenPractice ?? null,
  };
}
