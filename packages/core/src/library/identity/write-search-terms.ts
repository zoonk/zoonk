import "server-only";
import {
  type SearchTermsParams,
  generateSearchTerms,
} from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import { splitEvenly } from "@zoonk/utils/split-evenly";

const MAX_SUBJECTS_PER_CALL = 8;

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
