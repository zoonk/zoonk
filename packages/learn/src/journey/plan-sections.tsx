"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { GraduationCapIcon, NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DrawerCloseButton } from "../_components/details-drawer";
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

type MoreLinks = Pick<JourneyPathLinks, "exam"> & { mindMaps: string | null };

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
          <DrawerCloseButton />
        </DrawerHeader>
        <DrawerContent className="pt-2">
          <JourneyPath links={links} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
