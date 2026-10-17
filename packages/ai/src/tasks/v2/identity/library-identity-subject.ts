import { getPromptLanguageName } from "../../_utils/prompt-language";

/**
 * `source` asks for one document (a mirror or re-upload of it); `researchSource` asks for any
 * official, current document of a kind about one topic, such as a law's text, a product's docs or
 * a syllabus for a subject, which research reuses instead of searching again.
 */
export type LibraryIdentityKind =
  | "chapter"
  | "course"
  | "image"
  | "lesson"
  | "researchSource"
  | "skill"
  | "source";

/**
 * The fields identity search and the reuse decision read about one Library
 * item. Each kind fills the fields it has: skills for lessons, objectives for
 * chapters, a publisher and URL for sources, the prompt as the title of an image.
 */
export type LibraryIdentityItem = {
  title: string;
  description?: string | null;
  level?: string | null;
  targetLanguage?: string | null;
  /**
   * The courses of a chapter or lesson: the one a request is written for, or the courses a
   * candidate belongs to. The same words teach different content in another subject.
   */
  courses?: string[];
  skills?: string[];
  objectives?: string[];
  publisher?: string | null;
  url?: string | null;
};

/** What a caller needs: an item it would otherwise generate, and the goal it is for. */
export type LibraryIdentitySubject = {
  kind: LibraryIdentityKind;
  /** The content language, as a language code. */
  language: string;
  /** Only the general part of the learner's goal. Personal details never reach shared content. */
  goal?: string | null;
  item: LibraryIdentityItem;
};

/** An existing Library row the search found, described with the same fields as the request. */
export type LibraryIdentityCandidate = { id: string; item: LibraryIdentityItem };

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== undefined && value !== "";
}

/**
 * Drops empty fields so the model reads only what this kind of item has,
 * instead of guessing what an empty skills list or a null URL means.
 */
function compactItem(item: LibraryIdentityItem): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => hasValue(value)));
}

export function formatIdentityItem(item: LibraryIdentityItem): string {
  return JSON.stringify(compactItem(item), null, 2);
}

/** The request as the model reads it: kind, language name, goal and the item. */
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
