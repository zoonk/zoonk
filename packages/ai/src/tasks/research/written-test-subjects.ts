import { normalizeString } from "@zoonk/utils/string";
import { type BlueprintExtraction } from "./extract-exam-blueprint";

type Subject = BlueprintExtraction["subjects"][number];
type Section = NonNullable<BlueprintExtraction["mock"]>["sections"][number];

function namesSection({ label, section }: { label: string | null; section: string }): boolean {
  const own = label ? normalizeString(label) : "";
  return own.length > 0 && (section.includes(own) || own.includes(section));
}

function hasSubject({ section, subjects }: { section: Section; subjects: readonly Subject[] }) {
  const name = normalizeString(section.name);

  return subjects.some(
    (subject) =>
      namesSection({ label: subject.name, section: name }) ||
      namesSection({ label: subject.group, section: name }),
  );
}

function toSubject(section: Section): Subject {
  return {
    choiceGroup: null,
    group: section.name,
    matrix: [],
    name: section.name,
    partOf: null,
    passages: section.passages,
    questions: null,
    shortName: section.name,
    topicHeadings: [],
    topics: [],
    weight: null,
  };
}

/**
 * A written test the notice describes only in its conditions or scoring is still one of the exam's
 * subjects, so its points and minimum have a part to belong to.
 */
export function withWrittenTestSubjects(extraction: BlueprintExtraction): BlueprintExtraction {
  const missing = (extraction.mock?.sections ?? []).filter(
    (section) =>
      section.kind === "written" &&
      section.passages.length > 0 &&
      !hasSubject({ section, subjects: extraction.subjects }),
  );

  return missing.length === 0
    ? extraction
    : {
        ...extraction,
        subjects: [...extraction.subjects, ...missing.map((section) => toSubject(section))],
      };
}
