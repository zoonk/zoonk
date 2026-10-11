import { countItemLessons } from "../../../plans/_utils/stand-in-lessons";
import { findUpNextItem } from "../../../plans/_utils/up-next-item";
import { type SyllabusSubject, type SyllabusView } from "../syllabus-contract";
import { getSubjectProgress } from "./subject-progress";
import {
  buildChapters,
  chapterKeyOf,
  getEarliestTodoDate,
  getItemAreas,
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

/**
 * A goal's structure in the learner's terms: an exam's notice subjects with their topics in its
 * own words and order (grouped as the notice groups them), each with progress from the plan's
 * lessons and when the plan studies it next; or the plan's modules with their chapters. Topics get
 * a status only when the plan's skills say which topics they teach; otherwise they're listed as
 * the notice has them, so nothing is claimed that the plan can't back.
 */
export function buildSyllabus(
  input: SyllabusInput,
): Omit<SyllabusView, "examDocument" | "goal" | "knownTopicsReturn"> {
  const {
    areaCourses,
    chapterTitles,
    items,
    knownSkillIds,
    notice,
    outlinedUntil,
    pastBasicsSkillIds,
    skills,
    skippedAreas,
    skippedBaseIds,
    taughtSkillIds = new Set(),
    todayBlocks = [],
  } = input;

  const areas = listAreas(skills);
  const { drafts, kind } = draftSubjects({ areas, notice });
  const mapped = kind === "notice" && skills.some((skill) => skill.topics.length > 0);
  const itemArea = getItemAreas({ items, skills });
  const skillNames = new Map(skills.map((skill) => [skill.skillId, skill.name]));
  const next = findUpNextItem({ items, todayBlocks });
  const nextKey = next ? chapterKeyOf(next) : null;
  const keys = toKeys(drafts.map((draft) => draft.name));
  const lessonsOf = countItemLessons;

  const settledSkillIds = new Set([
    ...knownSkillIds,
    ...pastBasicsSkillIds,
    ...(skippedBaseIds ?? []),
  ]);

  const subjects = drafts.map((draft, index): SyllabusSubject => {
    const own = items.filter((item) => draft.areas.includes(itemArea(item) ?? ""));

    const chapters = buildChapters({
      chapterTitles,
      items: own,
      lessonsOf,
      nextKey,
      outlinedUntil,
      skillNames,
      taughtSkillIds,
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
        chapters,
        items: { all: items, own },
        knownSkillIds,
        mapped: subjectMapped,
        pastBasicsSkillIds,
        skills: { all: skills, own: ownSkills },
        skipped,
        skippedBaseIds,
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
      ...getSubjectProgress({ items: own, settledSkillIds, skills: ownSkills }),
      matrix: [...(draft.matrix ?? [])],
      name: draft.name,
      nextDate: getEarliestTodoDate(own),
      notPlannedReason: getNotPlannedReason({
        hasItems: own.length > 0,
        hasSkills: ownSkills.length > 0,
        known: ownSkills.every((skill) => knownSkillIds.has(skill.skillId)),
        skipped,
      }),
      questions: draft.questions,
      share: draft.share,
      shortName: getShortName({ areaCourses, draft }),
      source: draft.source,
      topicFrequencySource: draft.frequencySource ?? null,
      topics,
      topicsKnown: subjectMapped ? topics.filter((topic) => topic.status === "known").length : null,
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
    passMarks: fromNotice?.passMarks ?? null,
    questionsSource: fromNotice?.questionsSource ?? null,
    subjects,
    topicCount: subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
    topicsMapped: mapped,
    writtenPractice: input.writtenPractice ?? null,
  };
}
