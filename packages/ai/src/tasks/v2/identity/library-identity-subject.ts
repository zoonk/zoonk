import { getPromptLanguageName } from "../../_utils/prompt-language";

/**
 * `source` asks for one document (a mirror or re-upload of it); `researchSource` for any official,
 * current document of a kind about one topic, which research reuses instead of searching again.
 */
export type LibraryIdentityKind =
  | "chapter"
  | "course"
  | "image"
  | "lesson"
  | "researchSource"
  | "skill"
  | "source";

export type LibraryIdentityItem = {
  title: string;
  description?: string | null;
  level?: string | null;
  targetLanguage?: string | null;
  /** The same words teach different content in another subject. */
  courses?: string[];
  skills?: string[];
  objectives?: string[];
  publisher?: string | null;
  url?: string | null;
};

export type LibraryIdentitySubject = {
  kind: LibraryIdentityKind;
  language: string;
  /** Only the general part: personal details never reach shared content. */
  goal?: string | null;
  item: LibraryIdentityItem;
};

export type LibraryIdentityCandidate = { id: string; item: LibraryIdentityItem };

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== undefined && value !== "";
}

/** So the model never guesses what an empty skills list or a null URL means. */
function compactItem(item: LibraryIdentityItem): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => hasValue(value)));
}

export function formatIdentityItem(item: LibraryIdentityItem): string {
  return JSON.stringify(compactItem(item), null, 2);
}

export function formatIdentitySubject(subject: LibraryIdentitySubject): string {
  return JSON.stringify(
    {
      contentLanguage: getPromptLanguageName({ language: subject.language }),
      goal: subject.goal ?? null,
      kind: subject.kind,
      ...compactItem(subject.item),
    },
    null,
    2,
  );
}
