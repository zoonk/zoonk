"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { GraduationCapIcon, NetworkIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { type AlphabetLink, AlphabetRow } from "../language/units/alphabet-row";
import { type JourneyPathLinks } from "./journey-links";
import { JourneyPath } from "./journey-path";
import { JourneyPathList } from "./journey-path-list";
import { useRoadmapPhases } from "./use-roadmap";

/** Where the Plan's More section leads: the exam's page and the mind maps, when the goal has them. */
type MoreLinks = Pick<JourneyPathLinks, "exam"> & { mindMaps: string | null };

/**
 * "1 of 6 phases done": the phases behind the learner, of the ones the plan holds, as the roadmap
 * counts them (a language's phase holds several units, so it's counted as a phase too).
 */
function PathDetail() {
  const t = useExtracted();
  const { phases } = useRoadmapPhases();
  const done = phases.filter((phase) => phase.state === "done").length;

  if (phases.length < 2) {
    return null;
  }

  return (
    <PageSectionDetail>
      {t("{done, number} of {total, plural, one {# phase} other {# phases}} done", {
        done,
        total: phases.length,
      })}
    </PageSectionDetail>
  );
}

/** A goal without subjects of its own (a language's units, one course's plan): its path. */
export function PathSection({
  alphabet,
  links,
}: {
  alphabet: { link: AlphabetLink; onSkip: () => Promise<boolean> } | null;
  links: JourneyPathLinks;
}) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby="journey-path-title">
      <PageSectionHeader>
        <PageSectionTitle id="journey-path-title">{t("Your path")}</PageSectionTitle>
        <PathDetail />
      </PageSectionHeader>

      {alphabet && <AlphabetRow alphabet={alphabet.link} onSkip={alphabet.onSkip} />}

      <JourneyPathList links={links} />
    </PageSection>
  );
}

/**
 * Where the Plan leads that the sidebar lists from `lg` (the exam's page, the mind maps): under
 * `lg`, without a sidebar, they close the page.
 */
export function MoreSection({ links }: { links: MoreLinks }) {
  const t = useExtracted();

  if (!links.exam && !links.mindMaps) {
    return null;
  }

  return (
    <PageSection aria-labelledby="plan-more-title" className="lg:hidden">
      <PageSectionHeader>
        <PageSectionTitle id="plan-more-title">{t("More")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {links.exam && (
          <ListRowLink href={links.exam}>
            <ListRowLeading>
              <ListRowIcon>
                <GraduationCapIcon />
              </ListRowIcon>
            </ListRowLeading>
            <ListRowContent>
              <ListRowTitle>{t("About the exam")}</ListRowTitle>
            </ListRowContent>
          </ListRowLink>
        )}

        {links.mindMaps && (
          <ListRowLink href={links.mindMaps}>
            <ListRowLeading>
              <ListRowIcon>
                <NetworkIcon />
              </ListRowIcon>
            </ListRowLeading>
            <ListRowContent>
              <ListRowTitle>{t("Mind maps")}</ListRowTitle>
            </ListRowContent>
          </ListRowLink>
        )}
      </ListGroup>
    </PageSection>
  );
}

/** On a phone, the band opens every phase with its mocks and challenges, the path as a timeline. */
export function PhasesSheet({
  links,
  onOpenChange,
  open,
}: {
  links: JourneyPathLinks;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{t("Your path")}</DrawerTitle>
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>
        <DrawerContent className="pt-2">
          <JourneyPath links={links} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
