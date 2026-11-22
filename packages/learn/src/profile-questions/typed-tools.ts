import {
  MAX_PROFILE_FAVORITES_LENGTH,
  type ProfileQuestionView,
} from "@zoonk/core/profile/questions/contract";
import {
  PROFILE_FAVORITES_SEPARATOR,
  normalizeProfileFavorites,
  splitProfileFavorites,
} from "@zoonk/core/profile/questions/favorites";
import { type ProfileDraft } from "./profile-draft";

/** Joins typed tools as the server saves them, so their length counts as it does. */
export const TYPED_SEPARATOR = ", ";

function countCharacters(text: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- Counts code points, as the server's Zod `.max()` does.
  return [...text].length;
}

function fitsTypedTools(typed: readonly string[]): boolean {
  return countCharacters(typed.join(TYPED_SEPARATOR)) <= MAX_PROFILE_FAVORITES_LENGTH;
}

/** How many more characters a name can have before the typed tools pass the saved limit. */
function getTypedToolsRoom(typed: readonly string[]): number {
  const used =
    typed.length === 0 ? 0 : countCharacters(typed.join(TYPED_SEPARATOR) + TYPED_SEPARATOR);

  return Math.max(0, MAX_PROFILE_FAVORITES_LENGTH - used);
}

/**
 * Turns the names in the tools field into chips. A name an offered chip already has picks that
 * chip, a name already typed is left out, and a name that would pass the saved limit stays in the
 * field, whole.
 */
export function addTypedTools({
  draft,
  options,
}: {
  draft: ProfileDraft;
  options: ProfileQuestionView["options"];
}): ProfileDraft {
  const picks = [...draft.picks];
  const typed = [...draft.typed];
  const left: string[] = [];

  for (const name of splitProfileFavorites(draft.text)) {
    const key = name.toLowerCase();
    const offered = options.find((option) => option.label.toLowerCase() === key);
    const isTyped = typed.some((tool) => tool.toLowerCase() === key);

    if (offered && !picks.includes(offered.id)) {
      picks.push(offered.id);
    } else if (!offered && !isTyped) {
      (fitsTypedTools([...typed, name]) ? typed : left).push(name);
    }
  }

  return { ...draft, exclusive: null, picks, text: left.join(TYPED_SEPARATOR), typed };
}

/** Whether Add would change anything: false for an empty field or names that don't fit. */
export function canAddTypedTools({
  draft,
  options,
}: {
  draft: ProfileDraft;
  options: ProfileQuestionView["options"];
}): boolean {
  return addTypedTools({ draft, options }).text !== normalizeProfileFavorites(draft.text);
}

function countSeparators(text: string): number {
  return text.split(PROFILE_FAVORITES_SEPARATOR).length;
}

/**
 * What typing in the tools field does. A separator typed or pasted adds the names before it. The
 * field takes no more text once the name in it couldn't be added, and always lets text be deleted.
 */
export function typeInToolsField({
  draft,
  options,
  text,
}: {
  draft: ProfileDraft;
  options: ProfileQuestionView["options"];
  text: string;
}): ProfileDraft {
  if (countSeparators(text) > countSeparators(draft.text)) {
    return addTypedTools({ draft: { ...draft, text }, options });
  }

  const length = countCharacters(text.trim());
  const grows = length > countCharacters(draft.text.trim());

  return grows && length > getTypedToolsRoom(draft.typed)
    ? draft
    : { ...draft, exclusive: null, text };
}
