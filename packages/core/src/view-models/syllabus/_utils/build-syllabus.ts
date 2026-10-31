import { withinLessonScope } from "../../../plans/_utils/plan-end";
import { countItemLessons } from "../../../plans/_utils/stand-in-lessons";
import { findUpNextItem } from "../../../plans/_utils/up-next-item";
import { getSubjectMastery, getSubjectPreparation } from "../../../preparation/section-preparation";
import {
  type NotPlannedReason,
  type SyllabusSubject,
  type SyllabusView,
} from "../syllabus-contract";
import { getDisplayWeights } from "./display-weights";
import { getSubjectProgress } from "./subject-progress";
import {
  buildChapters,
  chapterKeyOf,
  getEarliestTodoDate,
  getItemAreas,
  withoutKey,
} from "./syllabus-chapters";
import { type SyllabusInput, type SyllabusItem } from "./syllabus-input";
import { draftSubjects, getShortName, listAreas, toKeys } from "./syllabus-subjects";
import {
  buildTopic,
  getNotPlannedReason,
  namesAnyTopic,
  withHeadingStatuses,
} from "./syllabus-topics";

/** Count each plan item once across subjects, including tested-out items covering multiple skills. */
function sumPlannedLessons({
  itemArea,
  items,
  subjects,
}: {
  itemArea: (item: SyllabusItem) => string | null;
  items: readonly SyllabusItem[];
  subjects: readonly SyllabusSubject[];
}): SyllabusView["lessons"] {
  const planned = new Set(
    subjects.flatMap((subject) => (subject.notPlannedReason ? [] : subject.areas)),
  );

  const { lessonsDone, lessonsKnown, lessonsTotal } = getSubjectProgress(
    items.filter((item) => planned.has(itemArea(item) ?? "")),
  );

  return { done: lessonsDone + lessonsKnown, known: lessonsKnown, total: lessonsTotal };
}

/** Why a subject can be out of the plan while the exam still tests it, so the goal counts it. */
const COUNTED_OUT = new Set<NotPlannedReason>(["pastBasics", "skippedBase", "time"]);

/** Excluded subjects show preparation only while their weighted sections still contribute to the goal. */
function measureSubject({
  areas,
  notPlannedReason,
  sections,
}: {
  areas: readonly string[];
  notPlannedReason: NotPlannedReason | null;
  sections: SyllabusInput["sections"];
}): Pick<SyllabusSubject, "mastery" | "preparation"> {
  if (!sections) {
    return { mastery: null, preparation: null };
  }

  if (!notPlannedReason) {
    return {
      mastery: getSubjectMastery({ areas, sections }),
      preparation: getSubjectPreparation({ areas, sections }) ?? 0,
    };
  }

  const counted = COUNTED_OUT.has(notPlannedReason)
    ? sections.filter((section) => areas.includes(section.section) && section.weight > 0)
    : [];

  if (counted.length === 0) {
    return { mastery: null, preparation: null };
  }

  return {
    mastery: getSubjectMastery({ areas, sections: counted }),
    preparation: getSubjectPreparation({ areas, sections: counted }),
  };
}

/** Topic status requires evidence from mapped plan skills; otherwise display notice topics without claiming coverage. */
export function buildSyllabus(
  input: SyllabusInput,
): Omit<SyllabusView, "examDocument" | "goal" | "knownTopicsReturn"> {
  const {
    areaCourses,
    chapterTitles,
    deadline = true,
    knownSkillIds,
    notice,
    outlinedUntil,
    pastBasicsSkillIds,
    sections = null,
    skills,
    skippedAreas,
    skippedBaseIds,
    taughtSkillIds = new Set(),
    todayBlocks = [],
  } = input;

  const items = withinLessonScope({ deadline, items: input.items });

  const areas = listAreas(skills);
  const { drafts, kind } = draftSubjects({ areas, notice });
  const displayWeights = getDisplayWeights(drafts);
  const mapped = kind === "notice" && skills.some((skill) => skill.topics.length > 0);
  const itemArea = getItemAreas({ items, skills });
  const skillNames = new Map(skills.map((skill) => [skill.skillId, skill.name]));
  const next = findUpNextItem({ items, todayBlocks });
  const nextKey = next ? chapterKeyOf(next) : null;
  const keys = toKeys(drafts.map((draft) => draft.name));
  const lessonsOf = countItemLessons;

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

    // A plan built from an older notice may teach the subject without mapping its current topic names.
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

    const notPlannedReason = getNotPlannedReason({
      hasItems: own.length > 0,
      hasSkills: ownSkills.length > 0,
      known: ownSkills.every((skill) => knownSkillIds.has(skill.skillId)),
      skipped,
    });

    const measured = measureSubject({ areas: draft.areas, notPlannedReason, sections });

    return {
      areas: draft.areas,
      chapters: chapters.map((chapter) => withoutKey(chapter)),
      displayWeight: displayWeights[index] ?? null,
      group: draft.group,
      imageUrl: draft.areas.map((area) => areaCourses.get(area)?.imageUrl).find(Boolean) ?? null,
      key: keys[index] ?? draft.name,
      ...getSubjectProgress(own),
      ...measured,
      matrix: [...(draft.matrix ?? [])],
      name: draft.name,
      nextDate: getEarliestTodoDate(own),
      notPlannedReason,
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
    lessons: sumPlannedLessons({ itemArea, items, subjects }),
    noticeUrl: fromNotice?.url ?? null,
    passMarks: fromNotice?.passMarks ?? null,
    questionsSource: fromNotice?.questionsSource ?? null,
    subjects,
    topicCount: subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
    topicsMapped: mapped,
    writtenPractice: input.writtenPractice ?? null,
  };
}
