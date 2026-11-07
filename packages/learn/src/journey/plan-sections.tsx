"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import {
  ChevronRightIcon,
  GraduationCapIcon,
  HistoryIcon,
  LibraryIcon,
  NetworkIcon,
} from "lucide-react";
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
import { LearnLink } from "../learn-link";
import { type JourneyPathLinks } from "./journey-links";
import { JourneyPath } from "./journey-path";
import { JourneyPathList } from "./journey-path-list";
import { PATH_ROW_CLASS, PATH_ROW_LEADING_CLASS } from "./journey-phase-events";
import { useRoadmapPhases } from "./use-roadmap";

type PathLinks = JourneyPathLinks & { completedLessons: string | null; mindMaps: string | null };

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

function PathLinkRow({
  children,
  className,
  href,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <LearnLink
      className={cn(
        PATH_ROW_CLASS,
        "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        className,
      )}
      href={href}
    >
      <span aria-hidden="true" className={PATH_ROW_LEADING_CLASS}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
    </LearnLink>
  );
}

function FullCourseRow({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <PathLinkRow href={href} icon={<LibraryIcon className="size-4" />}>
      {t("See the full course")}
    </PathLinkRow>
  );
}

function CompletedLessonsPathRow({ href }: { href: string | null }) {
  const t = useExtracted();

  if (!href) {
    return null;
  }

  return (
    <PathLinkRow className="lg:hidden" href={href} icon={<HistoryIcon className="size-4" />}>
      {t("Completed lessons")}
    </PathLinkRow>
  );
}

function MindMapsPathRow({ href }: { href: string | null }) {
  const t = useExtracted();

  if (!href) {
    return null;
  }

  return (
    <PathLinkRow className="lg:hidden" href={href} icon={<NetworkIcon className="size-4" />}>
      {t("Mind maps")}
    </PathLinkRow>
  );
}

/** From `lg` the sidebar holds the same ways in. */
export function PlanPlaceRows({
  links,
}: {
  links: Pick<PathLinks, "completedLessons" | "mindMaps">;
}) {
  return (
    <>
      <CompletedLessonsPathRow href={links.completedLessons} />
      <MindMapsPathRow href={links.mindMaps} />
    </>
  );
}

export function PathSection({
  alphabet,
  courseHref,
  links,
}: {
  alphabet: { link: AlphabetLink; onSkip: () => Promise<boolean> } | null;
  courseHref: string | null;
  links: PathLinks;
}) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby="journey-path-title">
      <PageSectionHeader>
        <PageSectionTitle id="journey-path-title">{t("Your path")}</PageSectionTitle>
        <PathDetail />
      </PageSectionHeader>

      <PlanPlaceRows links={links} />
      {alphabet && <AlphabetRow alphabet={alphabet.link} onSkip={alphabet.onSkip} />}

      <JourneyPathList links={links} />
      {courseHref && <FullCourseRow href={courseHref} />}
    </PageSection>
  );
}

export function MoreSection({ links }: { links: Pick<JourneyPathLinks, "exam"> }) {
  const t = useExtracted();

  if (!links.exam) {
    return null;
  }

  return (
    <PageSection aria-labelledby="plan-more-title" className="lg:hidden">
      <PageSectionHeader>
        <PageSectionTitle id="plan-more-title">
          {t({
            description: "A menu or section of other options and links, like an app's “More” menu.",
            message: "More",
          })}
        </PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
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
