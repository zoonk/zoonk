import { useExtracted } from "next-intl";
import { ListGroup, ListRow, ListRowContent, ListRowTitle } from "../_components/list-group";
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
              "Titles the list of what a subject or module contains, on its page while it's out of the learner's plan, so they can decide whether to add it back. Their plan doesn't teach it, so the title names its contents without promising they'll learn them.",
            message: "What it covers",
          })}
        </PageSectionTitle>
      </PageSectionHeader>

      <ListGroup as="ul" aria-labelledby={COVERS_TITLE_ID}>
        {covers.map((name) => (
          <li key={name}>
            <ListRow>
              <ListRowContent>
                <ListRowTitle>{name}</ListRowTitle>
              </ListRowContent>
            </ListRow>
          </li>
        ))}
      </ListGroup>
    </PageSection>
  );
}
