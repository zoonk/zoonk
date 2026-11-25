"use client";

import { useExtracted } from "next-intl";
import { LIST_GROUP_CLASS, ListRow, ListRowContent, ListRowTitle } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";

const COVERS_TITLE_ID = "subject-covers-title";

export function SubjectCovers({ covers }: { covers: readonly string[] }) {
  const t = useExtracted();

  if (covers.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={COVERS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={COVERS_TITLE_ID}>
          {t({
            description:
              "Titles the list of what a subject or module out of the learner's plan would teach, so they can decide whether to make room for it.",
            message: "What it covers",
          })}
        </PageSectionTitle>
      </PageSectionHeader>

      <ul aria-labelledby={COVERS_TITLE_ID} className={LIST_GROUP_CLASS}>
        {covers.map((name) => (
          <li key={name}>
            <ListRow>
              <ListRowContent>
                <ListRowTitle>{name}</ListRowTitle>
              </ListRowContent>
            </ListRow>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}
