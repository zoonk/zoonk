"use client";

import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";

const TITLE_ID = "mind-maps-reference-title";

/**
 * "For reference" on a goal's pages (the Journey, a subject's page): the way to the mind maps of
 * the chapters the learner finished. The host shows it once there's a finished chapter.
 */
export function MindMapsReference({ description, href }: { description: string; href: string }) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby={TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TITLE_ID}>{t("For reference")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        <ListRowLink href={href}>
          <ListRowLeading>
            <KindTile kind="mindMap" />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{t("Mind maps")}</ListRowTitle>
            <ListRowDescription>{description}</ListRowDescription>
          </ListRowContent>
        </ListRowLink>
      </ListGroup>
    </PageSection>
  );
}
