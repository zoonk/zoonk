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

/**
 * The lessons of the subjects in the plan, together: what a goal that isn't an exam reads as its
 * progress, so the whole reads as its subjects' bars and 100% once the plan is finished (both count
 * the plan's lessons, see `isInLessonScope`). Each plan item counts once, though a tested-out
 * lesson shows in every subject whose skills it covers.
 */
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

/**
 * An exam subject's preparation by its sections, and the answers that back it (other goals read
 * lessons; nothing without sections). One in the plan the goal measures none of reads as nothing
 * prepared yet, not as unmeasured. One out of the plan keeps its number only while the goal's
 * counts it (left out for time, its basics passed, its bases skipped), read from its sections that
 * weigh in the goal, so the goal's number reads as the subjects it lists: Ana's 14% sat under
 * every subject she saw. One the learner took out, nothing teaches yet, or that weighs nothing has
 * none, whatever they studied of it before.
 */
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

  // Everything here counts the lessons the plan's number and "finished" count.
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
