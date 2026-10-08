import "server-only";
import {
  type SearchTermsParams,
  generateSearchTerms,
} from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import { splitEvenly } from "@zoonk/utils/split-evenly";

/**
 * Items per model call. The instructions are most of a call's input, so a call for many items
 * costs far less per item than one each (the library-search-terms eval: about 1.8k input and 500
 * to 800 output tokens for 7 or 8 items, against 1.2k and 200 for one). Output is written token
 * by token, though, so each item adds about half a second: eight keeps a chapter's lessons or
 * skills in one call that answers in about as long as the parallel single calls did.
 */
const MAX_SUBJECTS_PER_CALL = 8;

/**
 * Writes the search terms of every subject a caller needs at once, in as few model calls as
 * `MAX_SUBJECTS_PER_CALL` allows, run in parallel. Returns each subject's terms in order; a
 * subject the model left out gets none, so only its own words are searched.
 */
export async function writeSearchTerms({
  analytics,
  subjects,
}: {
  analytics?: SearchTermsParams["analytics"];
  subjects: readonly LibraryIdentitySubject[];
}): Promise<string[][]> {
  const chunks = splitEvenly({ items: subjects, size: MAX_SUBJECTS_PER_CALL });

  const written = await Promise.all(
    chunks.map((chunk) => generateSearchTerms({ analytics, subjects: chunk })),
  );

  return written.flatMap(({ data }) => data.subjects.map((subject) => subject.terms));
}
