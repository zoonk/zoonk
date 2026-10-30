"use client";

import {
  LearnerAvatar,
  PendingAccountAvatar,
} from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserDropdownMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-dropdown-menu";
import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { VisitorLook } from "@/components/learner/visitor-look";
import { useBeltLabel } from "@/lib/belt-label";
import {
  type LearnerSummary,
  type LearnerSummaryPlaces,
} from "@zoonk/core/learner/summary/contract";
import { DropdownMenu, DropdownMenuTrigger } from "@zoonk/ui/components/dropdown-menu";
import { SIDEBAR_ACCOUNT_CLASS } from "@zoonk/ui/components/sidebar";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { BeltLevel } from "./learn-bar-end";
import { LearnSidebarLink } from "./learn-sidebar-links";

function StudyLinksView({ places }: { places: LearnerSummaryPlaces | null }) {
  const t = useExtracted();

  return (
    <>
      <LearnSidebarLink
        count={places?.readyMistakes}
        label={t("Mistakes notebook")}
        menu="mistakes"
      />
      {places?.exam && <LearnSidebarLink label={t("Exam")} menu="exam" />}
      {places?.speaking && <LearnSidebarLink label={t("Speaking")} menu="speaking" />}
      {places?.mindMaps && <LearnSidebarLink label={t("Mind maps")} menu="mindMaps" />}
      <LearnSidebarLink label={t("Statistics")} menu="stats" />
    </>
  );
}

function FrameStudyLinks() {
  const learner = useFrameLearner();
  return <StudyLinksView places={learner.status === "ready" ? learner.summary.places : null} />;
}

export function StudyLinks() {
  return (
    <Suspense fallback={<StudyLinksView places={null} />}>
      <FrameStudyLinks />
    </Suspense>
  );
}

function PendingSidebarAccount({ visitor }: { visitor: React.ReactNode }) {
  return (
    <>
      <VisitorLook>{visitor}</VisitorLook>
      <div aria-hidden="true" className="signed-in:flex hidden h-11 w-full items-center px-1">
        <PendingAccountAvatar className="size-6" />
      </div>
    </>
  );
}

/** Named by its visible words first, so voice control users press it by the name they see. */
function AccountTrigger({
  children,
  name,
  said,
}: {
  children?: React.ReactNode;
  name: string;
  said: string[];
}) {
  return (
    <DropdownMenuTrigger className={SIDEBAR_ACCOUNT_CLASS}>
      <span aria-hidden="true" className="flex size-6 shrink-0 overflow-hidden rounded-full">
        <LearnerAvatar />
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="sr-only">{`, ${said.join(", ")}`}</span>
      {children}
    </DropdownMenuTrigger>
  );
}

function AccountTriggerWithLevel({
  level,
  name,
}: {
  level: NonNullable<LearnerSummary["level"]>;
  name: string;
}) {
  const t = useExtracted();
  const belt = useBeltLabel(level.color);
  const levelNumber = String(level.level);

  const said = [t("{belt}, level {level}", { belt, level: levelNumber }), t("User menu")];

  return (
    <AccountTrigger name={name} said={said}>
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 pr-1 font-mono text-xs font-normal tabular-nums">
        <BeltLevel belt={belt} color={level.color} level={levelNumber} />
      </span>
    </AccountTrigger>
  );
}

function AccountTriggerWithoutLevel({ name }: { name: string }) {
  const t = useExtracted();
  return <AccountTrigger name={name} said={[t("User menu")]} />;
}

function AccountRow({ summary }: { summary: LearnerSummary }) {
  const t = useExtracted();
  const { account, identity, level } = summary;
  const name = identity.isAnonymous ? t("Guest") : account.name || account.email;

  return (
    <DropdownMenu>
      {level ? (
        <AccountTriggerWithLevel level={level} name={name} />
      ) : (
        <AccountTriggerWithoutLevel name={name} />
      )}

      <UserDropdownMenu align="start" side="top" />
    </DropdownMenu>
  );
}

function FrameAccount({ visitor }: { visitor: React.ReactNode }) {
  const learner = useFrameLearner();

  if (learner.status === "visitor") {
    return visitor;
  }

  if (learner.status !== "ready") {
    return <PendingSidebarAccount visitor={visitor} />;
  }

  return <AccountRow summary={learner.summary} />;
}

export function SidebarAccount({ visitor }: { visitor: React.ReactNode }) {
  return (
    <Suspense fallback={<PendingSidebarAccount visitor={visitor} />}>
      <FrameAccount visitor={visitor} />
    </Suspense>
  );
}
