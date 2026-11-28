import { useExtracted, useFormatter } from "next-intl";
import { ListGroup, ListRow, ListRowContent, ListRowTitle } from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";

function SkillNames({
  detail,
  id,
  names,
  title,
}: {
  detail?: string;
  id: string;
  names: readonly string[];
  title: string;
}) {
  if (names.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={id}>
      <PageSectionHeader>
        <PageSectionTitle id={id}>{title}</PageSectionTitle>
        {detail && <PageSectionDetail>{detail}</PageSectionDetail>}
      </PageSectionHeader>

      <ListGroup as="ul" aria-labelledby={id}>
        {names.map((name) => (
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

export function SubjectCovers({ covers }: { covers: readonly string[] }) {
  const t = useExtracted();

  return (
    <SkillNames
      id="subject-covers-title"
      names={covers}
      title={t({
        description:
          "Titles the list of what a subject or module contains, on its page while it's out of the learner's plan, so they can decide whether to add it back. Their plan doesn't teach it, so the title names its contents without promising they'll learn them.",
        message: "What it covers",
      })}
    />
  );
}

/** The topics of a subject in the plan that its date leaves out, after the chapters it keeps. */
export function SubjectLeftOut({ leftOut }: { leftOut: readonly string[] }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <SkillNames
      detail={format.number(leftOut.length)}
      id="subject-left-out-title"
      names={leftOut}
      title={t("Not in your plan")}
    />
  );
}
