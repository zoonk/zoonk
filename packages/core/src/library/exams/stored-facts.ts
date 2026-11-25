import { normalizeString } from "@zoonk/utils/string";
import { type BlueprintContent, type Citation, type ExamStructure } from "./blueprint-contract";

type Mock = NonNullable<ExamStructure["mock"]>;
type Section = Mock["sections"][number];
type Scoring = Mock["scoring"];
type KindedItem = { citation: Citation; kind?: string };

const NON_FACT_KEYS = new Set(["citation", "citations", "key", "translations"]);

function countFacts(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countFacts(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !NON_FACT_KEYS.has(key))
      .reduce((sum, [, item]) => sum + countFacts(item), 0);
  }

  return value === null || value === undefined || value === "" || value === false ? 0 : 1;
}

function kindOf(item: KindedItem): string {
  return item.kind ?? "other";
}

/** In the stored order, so a kept item isn't reported as a change. */
function keepLeftOutKinds<T extends KindedItem>({
  isCited,
  read,
  stored,
}: {
  isCited: (citation: Citation) => boolean;
  read: T[];
  stored: T[];
}): T[] {
  if (read.length === 0) {
    return read;
  }

  const readKinds = Map.groupBy(read, (item) => kindOf(item));
  const kinds = new Set([...stored, ...read].map((item) => kindOf(item)));

  return [...kinds].flatMap(
    (kind) =>
      readKinds.get(kind) ??
      stored.filter((item) => kindOf(item) === kind && isCited(item.citation)),
  );
}

/** A scoring the check didn't confirm comes back as "other" with no description. */
function isUnknownScoring(scoring: Scoring): boolean {
  return scoring.method === "other" && !scoring.description;
}

function orStored<T>({ read, stored }: { read: T[] | undefined; stored: T[] | undefined }) {
  return read && read.length > 0 ? read : stored;
}

function fillScoring({ read, stored }: { read: Scoring; stored: Scoring }): Scoring {
  if (isUnknownScoring(read)) {
    return stored;
  }

  if (read.method !== stored.method) {
    return read;
  }

  const finalShares = orStored({ read: read.finalShares, stored: stored.finalShares });
  const marking = orStored({ read: read.marking, stored: stored.marking });
  const parts = orStored({ read: read.parts, stored: stored.parts });
  const relative = read.relative ?? stored.relative;
  const scale = read.scale ?? stored.scale;
  const totalMinimum = read.totalMinimum ?? stored.totalMinimum;
  const wrongPenalty = read.wrongPenalty ?? stored.wrongPenalty;

  return {
    ...read,
    description: read.description || stored.description,
    ...(finalShares && { finalShares }),
    ...(marking && { marking }),
    ...(parts && { parts }),
    ...(relative !== undefined && { relative }),
    ...(scale !== undefined && { scale }),
    ...(totalMinimum !== undefined && { totalMinimum }),
    ...(wrongPenalty !== undefined && { wrongPenalty }),
  };
}

function fillSection({ read, stored }: { read: Section; stored: Section }): Section {
  const breakAfterMinutes = read.breakAfterMinutes ?? stored.breakAfterMinutes;
  const navigation = read.navigation ?? stored.navigation;
  const session = read.session ?? stored.session;
  const tasks = countFacts(read.tasks) >= countFacts(stored.tasks) ? read.tasks : stored.tasks;
  const tools = read.tools ?? stored.tools;

  return {
    ...read,
    ...(breakAfterMinutes !== undefined && { breakAfterMinutes }),
    day: read.day ?? stored.day,
    minutes: read.minutes ?? stored.minutes,
    ...(navigation !== undefined && { navigation }),
    questions: read.questions ?? stored.questions,
    ...(session !== undefined && { session }),
    ...(tasks !== undefined && { tasks }),
    ...(tools !== undefined && { tools }),
  };
}

/**
 * Sections pair by name. A stored section the reading didn't name is kept only when the reading
 * named none: one it renamed would otherwise sit twice in every mock.
 */
function fillSections({ read, stored }: { read: Section[]; stored: Section[] }): Section[] {
  if (read.length === 0) {
    return stored;
  }

  const byName = new Map(stored.map((section) => [normalizeString(section.name), section]));

  return read.map((section) => {
    const match = byName.get(normalizeString(section.name));
    return match ? fillSection({ read: section, stored: match }) : section;
  });
}

function fillMock({ read, stored }: { read: Mock | null; stored: Mock | null }): Mock | null {
  if (!read || !stored) {
    return read;
  }

  return {
    ...read,
    adaptive: read.adaptive || stored.adaptive,
    order: read.order ?? stored.order,
    scoring: fillScoring({ read: read.scoring, stored: stored.scoring }),
    sections: fillSections({ read: read.sections, stored: stored.sections }),
    timeLimitMinutes: read.timeLimitMinutes ?? stored.timeLimitMinutes,
    totalQuestions: read.totalQuestions ?? stored.totalQuestions,
  };
}

export function isSameNotice({
  read,
  stored,
}: {
  read: BlueprintContent;
  stored: BlueprintContent;
}): boolean {
  const { sourceHash } = read.edition;
  return sourceHash !== null && sourceHash === stored.edition.sourceHash;
}

/**
 * A reading holds only what one extraction stated and one check confirmed, so a fact it leaves out
 * may still be in the documents. The mock's parts carry no passage of their own, so only a re-read
 * of the same notice fills them from the stored mock.
 */
export function keepStoredFacts({
  isCited,
  read,
  stored,
}: {
  isCited: (citation: Citation) => boolean;
  read: BlueprintContent;
  stored: BlueprintContent;
}): BlueprintContent {
  const sameNotice = isSameNotice({ read, stored });

  const keep = <T extends KindedItem>(items: { read: T[]; stored: T[] }) =>
    keepLeftOutKinds({ isCited, ...items });

  return {
    ...read,
    edition: {
      ...read.edition,
      dates: keep({ read: read.edition.dates, stored: stored.edition.dates }),
    },
    structure: {
      ...read.structure,
      formats: keep({ read: read.structure.formats, stored: stored.structure.formats }),
      mock: sameNotice
        ? fillMock({ read: read.structure.mock, stored: stored.structure.mock })
        : read.structure.mock,
      rules: keep({ read: read.structure.rules, stored: stored.structure.rules }),
    },
  };
}
