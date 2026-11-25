import { type BlueprintContent, type Citation } from "./blueprint-contract";

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

  return value === null || value === undefined || value === "" ? 0 : 1;
}

/**
 * Two readings of one notice word their items differently, so items can't be paired across them:
 * a section comes whole from the reading that confirmed more of it.
 */
function saysMore<T>({ read, stored }: { read: T; stored: T }): T {
  return countFacts(stored) > countFacts(read) ? stored : read;
}

function kindOf(item: KindedItem): string {
  return item.kind ?? "other";
}

function keepLeftOutKinds<T extends KindedItem>({
  isCited,
  read,
  stored,
}: {
  isCited: (citation: Citation) => boolean;
  read: T[];
  stored: T[];
}): T[] {
  const readKinds = Map.groupBy(read, (item) => kindOf(item));
  const kept = stored.filter((item) => !readKinds.has(kindOf(item)) && isCited(item.citation));

  if (read.length === 0 || kept.length === 0) {
    return read;
  }

  const keptKinds = Map.groupBy(kept, (item) => kindOf(item));
  const kinds = new Set([...stored, ...read].map((item) => kindOf(item)));

  // In the stored order, so a kept item isn't reported as a change.
  return [...kinds].flatMap((kind) => readKinds.get(kind) ?? keptKinds.get(kind) ?? []);
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

function keepFromSameNotice({
  read,
  stored,
}: {
  read: BlueprintContent;
  stored: BlueprintContent;
}): BlueprintContent {
  return {
    ...read,
    edition: {
      ...read.edition,
      dates: saysMore({ read: read.edition.dates, stored: stored.edition.dates }),
    },
    structure: {
      ...read.structure,
      formats: saysMore({ read: read.structure.formats, stored: stored.structure.formats }),
      mock: saysMore({ read: read.structure.mock, stored: stored.structure.mock }),
      rules: saysMore({ read: read.structure.rules, stored: stored.structure.rules }),
    },
  };
}

/**
 * A changed notice may have removed what its reading left out, and only formats, rules and dates
 * carry a passage to check that against; the mock's parts don't, so it's taken as read.
 */
function keepFromChangedNotice({
  isCited,
  read,
  stored,
}: {
  isCited: (citation: Citation) => boolean;
  read: BlueprintContent;
  stored: BlueprintContent;
}): BlueprintContent {
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
      rules: keep({ read: read.structure.rules, stored: stored.structure.rules }),
    },
  };
}

/** A reading holds only what one extraction stated and one check confirmed that run. */
export function keepStoredFacts({
  isCited,
  read,
  stored,
}: {
  isCited: (citation: Citation) => boolean;
  read: BlueprintContent;
  stored: BlueprintContent;
}): BlueprintContent {
  return isSameNotice({ read, stored })
    ? keepFromSameNotice({ read, stored })
    : keepFromChangedNotice({ isCited, read, stored });
}
