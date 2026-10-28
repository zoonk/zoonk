import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { listChoiceGroups } from "../../exams/choices/exam-choices";
import { type ReusePolicy } from "../sources/source-contract";
import {
  type BlueprintContent,
  type Citation,
  type ExamStructure,
  isFormatShare,
  toAnswerFormat,
} from "./blueprint-contract";
import { type FactEntry } from "./blueprint-fact-claims";
import { type KeptFacts, keptOr, toKeptFacts } from "./blueprint-kept";
import { toTestedLanguage } from "./blueprint-language";
import { toMock } from "./blueprint-mock-content";
import { type ExtractionDocument } from "./blueprint-passages";
import { toSubjectTopics } from "./blueprint-subject-topics";
import { getFormatShares, isObjectiveFormat } from "./format-shares";
import { isObjectiveTestUnread } from "./objective-test";

type Extraction = BlueprintExtraction;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

function keepItems<T>({ items, kept, prefix }: { items: T[]; kept: KeptFacts; prefix: string }) {
  return items.flatMap((item, index) => {
    const id = `${prefix}.${index}`;
    const found = kept.get(id)?.[0];
    return found ? [{ found, id, item }] : [];
  });
}

function isValidDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function toStartTime(value: string | null): string | null {
  return value && CLOCK_TIME_PATTERN.test(value) ? value : null;
}

function toTimeZone(value: string | null): string | null {
  return value && isValidTimeZone(value) ? value : null;
}

function toShortName({ name, shortName }: { name: string; shortName?: string | null }) {
  const short = shortName?.trim();
  return short && short.length < name.trim().length ? short : null;
}

function toSubject({
  documents,
  found,
  groups,
  id,
  item,
  kept,
}: {
  documents: ExtractionDocument[];
  found: Citation;
  groups: ReadonlySet<string>;
  id: string;
  item: Extraction["subjects"][number];
  kept: KeptFacts;
}): ExamStructure["subjects"][number] {
  const choiceGroup = keptOr({ gap: null, id: `${id}.choiceGroup`, kept, value: item.choiceGroup });
  const partOf = keptOr({ gap: null, id: `${id}.partOf`, kept, value: item.partOf });

  return {
    ...(choiceGroup && { choiceGroup }),
    citation: found,
    group: item.group && groups.has(item.group) ? item.group : null,
    name: item.name,
    ...(partOf && { partOf }),
    questions: keptOr({ gap: null, id: `${id}.questions`, kept, value: item.questions }),
    shortName: toShortName(item),
    ...toSubjectTopics({ documents, subject: item }),
    weight: keptOr({ gap: null, id: `${id}.weight`, kept, value: item.weight }),
  };
}

function findKeptGroups({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  return new Set(
    extraction.subjects.flatMap((subject, index) =>
      subject.group && kept.has(`subjects.${index}.group`) ? [subject.group] : [],
    ),
  );
}

function keepRealChoices(subjects: ExamStructure["subjects"]): ExamStructure["subjects"] {
  const choices = new Set(listChoiceGroups(subjects).map((choice) => choice.name));
  const names = new Set(subjects.map((subject) => subject.name));

  return subjects.map(({ choiceGroup, partOf, ...subject }) => ({
    ...subject,
    ...(choiceGroup && choices.has(choiceGroup) && { choiceGroup }),
    ...(partOf && partOf !== subject.name && names.has(partOf) && { partOf }),
  }));
}

function withFormatShares({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  const shares = getFormatShares(
    extraction.formats.map((format, index) => ({
      count:
        kept.has(`formats.${index}`) && kept.has(`formats.${index}.count`)
          ? (format.count ?? null)
          : null,
      kind: format.kind,
    })),
  );

  return extraction.formats.map((format, index) => ({ ...format, share: shares[index] }));
}

function countFormatQuestions({ extraction, kept }: { extraction: Extraction; kept: KeptFacts }) {
  const counts = extraction.formats.flatMap((format, index) => {
    if (!isObjectiveFormat(format.kind)) {
      return [];
    }

    const { count } = format;
    const citations = kept.has(`formats.${index}`) ? kept.get(`formats.${index}.count`) : undefined;
    const isTotal = count?.per === "exam" && count.unit === "questions";

    return [isTotal && citations ? { citations, value: count.value } : null];
  });

  if (counts.length === 0 || counts.includes(null)) {
    return null;
  }

  const citations = counts.flatMap((count) => count?.citations ?? []);

  return {
    citations: [...new Map(citations.map((item) => [JSON.stringify(item), item])).values()],
    questions: counts.reduce((sum, count) => sum + (count?.value ?? 0), 0),
  };
}

function toStructure({
  documents,
  extraction,
  kept,
}: {
  documents: ExtractionDocument[];
  extraction: Extraction;
  kept: KeptFacts;
}): ExamStructure {
  const groups = findKeptGroups({ extraction, kept });

  return {
    formats: keepItems({
      items: withFormatShares({ extraction, kept }),
      kept,
      prefix: "formats",
    }).map(({ found, id, item }) => ({
      citation: found,
      description:
        item.kind === "other"
          ? item.description
          : keptOr({ gap: "", id: `${id}.description`, kept, value: item.description }),
      kind: item.kind,
      options: item.options,
      ...toAnswerFormat(item),
      ...(item.partialCredit && kept.has(`${id}.partialCredit`)
        ? { partialCredit: item.partialCredit }
        : {}),
      ...(isFormatShare(item.share) ? { share: item.share } : {}),
    })),
    mock: toMock({ extraction, kept }),
    rules: keepItems({ items: extraction.rules, kept, prefix: "rules" }).map(({ found, item }) => ({
      citation: found,
      kind: item.kind,
      text: item.text,
    })),
    subjects: keepRealChoices(
      keepItems({ items: extraction.subjects, kept, prefix: "subjects" }).map(
        ({ found, id, item }) => toSubject({ documents, found, groups, id, item, kept }),
      ),
    ),
    testedLanguage: toTestedLanguage({ extraction, kept }),
  };
}

export function toBlueprintContent({
  documents,
  extraction,
  facts,
  noticeUrl,
  sourceHash,
  supportedIds,
}: {
  documents: ExtractionDocument[];
  extraction: BlueprintExtraction;
  facts: FactEntry[];
  noticeUrl: string | null;
  sourceHash: string;
  supportedIds: string[];
}): BlueprintContent {
  const kept = toKeptFacts({ facts, supportedIds });
  const { edition } = extraction;

  const formatTotal = kept.has("edition.questionCount")
    ? null
    : countFormatQuestions({ extraction, kept });

  return {
    edition: {
      check: null,
      citations:
        kept.get("edition.year") ??
        kept.get("edition.questionCount") ??
        formatTotal?.citations ??
        [],
      dates: keepItems({ items: extraction.dates, kept, prefix: "dates" })
        .filter(({ item }) => isValidDate(item.date))
        .map(({ found, id, item }) => ({
          citation: found,
          date: item.date,
          kind: item.kind,
          label: item.label,
          startTime: keptOr({
            gap: null,
            id: `${id}.startTime`,
            kept,
            value: toStartTime(item.startTime),
          }),
        })),
      noticeUrl,
      questionCount: keptOr({
        gap: formatTotal?.questions ?? null,
        id: "edition.questionCount",
        kept,
        value: edition.questionCount,
      }),
      sourceHash,
      timeZone: toTimeZone(edition.timeZone),
      year: keptOr({ gap: null, id: "edition.year", kept, value: edition.year }),
    },
    structure: toStructure({ documents, extraction, kept }),
    topicFrequency: keepItems({
      items: extraction.topicFrequency,
      kept,
      prefix: "topicFrequency",
    }).map(({ found, item }) => ({
      appearances: item.appearances,
      basis: item.basis,
      citation: found,
      level: item.level,
      subject: item.subject,
      topic: item.topic,
    })),
  };
}

function describesExam({ edition, structure }: BlueprintContent): boolean {
  return (
    structure.formats.length > 0 ||
    structure.mock !== null ||
    structure.rules.length > 0 ||
    edition.dates.length > 0 ||
    edition.questionCount !== null ||
    structure.subjects.some((subject) => subject.questions !== null || subject.weight !== null)
  );
}

export function isUsableBlueprint({
  content,
  shared,
}: {
  content: BlueprintContent;
  shared: boolean;
}): boolean {
  const { edition, structure } = content;

  const plans =
    structure.subjects.length > 0 || (structure.mock !== null && edition.dates.length > 0);

  return plans && (!shared || (describesExam(content) && !isObjectiveTestUnread(content)));
}

export function toReusePolicy({
  extraction,
  facts,
  supportedIds,
}: {
  extraction: BlueprintExtraction;
  facts: FactEntry[];
  supportedIds: string[];
}): { policy: ReusePolicy; sourceId: string } | null {
  const citation = toKeptFacts({ facts, supportedIds }).get("reusePolicy")?.[0];
  const { pastQuestions } = extraction.reusePolicy;

  if (!citation || pastQuestions === "unknown") {
    return null;
  }

  return {
    policy: { basis: citation.passage, honorTakedowns: true, pastQuestions, termsUrl: null },
    sourceId: citation.sourceId,
  };
}
