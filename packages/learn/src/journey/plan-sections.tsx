"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { GraduationCapIcon, HistoryIcon, LibraryIcon, NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DrawerCloseButton } from "../_components/details-drawer";
import {
  ListGroup,
  ListRowChevron,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { type AlphabetLink, AlphabetRow } from "../language/units/alphabet-row";
import { LearnLink } from "../learn-link";
import { type JourneyPathLinks } from "./journey-links";
import { JourneyPath } from "./journey-path";
import { JourneyPathList } from "./journey-path-list";
import { PATH_ROW_CLASS, PATH_ROW_LEADING_CLASS } from "./journey-phase-events";

type MoreLinks = Pick<JourneyPathLinks, "exam"> & {
  completedLessons: string | null;
  mindMaps: string | null;
};

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
      <ListRowChevron />
    </LearnLink>
  );
}

function FullCourseRow({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <PathLinkRow className="min-h-12" href={href} icon={<LibraryIcon className="size-4" />}>
      {t("See the full course")}
    </PathLinkRow>
  );
}

export function PathSection({
  alphabet,
  children,
  courseHref,
  links,
}: {
  alphabet: { link: AlphabetLink; onSkip: () => Promise<boolean> } | null;
  children?: React.ReactNode;
  courseHref: string | null;
  links: JourneyPathLinks;
}) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby="journey-path-title">
      <PageSectionHeader>
        <PageSectionTitle id="journey-path-title">{t("Your path")}</PageSectionTitle>
      </PageSectionHeader>

      {children}
      {alphabet && <AlphabetRow alphabet={alphabet.link} onSkip={alphabet.onSkip} />}

      <div className="flex flex-col">
        <JourneyPathList links={links} />
        {courseHref && (
          <div className="border-t">
            <FullCourseRow href={courseHref} />
          </div>
        )}
      </div>
    </PageSection>
  );
}

function MoreRow({
  children,
  href,
  icon,
}: {
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon>{icon}</ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{children}</ListRowTitle>
      </ListRowContent>
    </ListRowLink>
  );
}

/** From `lg` the sidebar holds the same ways in. */
export function MoreSection({ links }: { links: MoreLinks }) {
  const t = useExtracted();

  if (!links.exam && !links.completedLessons && !links.mindMaps) {
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
        {links.completedLessons && (
          <MoreRow href={links.completedLessons} icon={<HistoryIcon />}>
            {t("Completed lessons")}
          </MoreRow>
        )}
        {links.mindMaps && (
          <MoreRow href={links.mindMaps} icon={<NetworkIcon />}>
            {t("Mind maps")}
          </MoreRow>
        )}
        {links.exam && (
          <MoreRow href={links.exam} icon={<GraduationCapIcon />}>
            {t("About the exam")}
          </MoreRow>
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
        <DrawerContent>
          <JourneyPath links={links} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
