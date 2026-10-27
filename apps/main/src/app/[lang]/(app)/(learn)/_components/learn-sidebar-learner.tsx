"use client";

import {
  LearnerAvatar,
  PendingAccountAvatar,
} from "@/app/[lang]/(app)/(catalog)/_components/user-avatar";
import { UserDropdownMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-dropdown-menu";
import { VisitorLook } from "@/components/learner/visitor-look";
import { useBeltLabel } from "@/lib/belt-label";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { DropdownMenu, DropdownMenuTrigger } from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { BeltLevel } from "./learn-bar-end";
import { LearnSidebarLink } from "./learn-sidebar-links";

/**
 * The goal's places in its order: the mistakes notebook with how many are ready to practice, an
 * exam's page, a language goal's speaking paper and the mind maps when there are some, then the
 * learner's statistics. Until the learner is read (and for a visitor), the two every learner has.
 */
export function StudyLinks() {
  const t = useExtracted();
  const learner = useLearnerSummary();
  const places = learner.status === "ready" ? learner.summary.places : null;

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

/**
 * The account row: the sidebar wide and 44px tall, so the whole row is one target, on the
 * sidebar's soft fill while hovered or open.
 */
const ACCOUNT_ROW_CLASS =
  "hover:bg-sidebar-accent/70 aria-expanded:bg-sidebar-accent focus-visible:ring-ring/50 flex h-11 w-full min-w-0 items-center gap-2.5 rounded-md px-1 text-left text-[0.84375rem] font-medium transition-colors outline-none focus-visible:ring-[3px]";

/**
 * The account row's place while the learner is unread: a visitor's Pricing and way in, or on a page
 * marked signed in the row's quiet avatar, its name filled in with the rest once read.
 */
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

/**
 * The row is named by its words: the learner's name on screen, then what only screen readers hear
 * (`said`), so voice control users press it by the name they see.
 */
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
    <DropdownMenuTrigger className={ACCOUNT_ROW_CLASS}>
      <span aria-hidden="true" className="flex size-6 shrink-0 overflow-hidden rounded-full">
        <LearnerAvatar />
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="sr-only">{`, ${said.join(", ")}`}</span>
      {children}
    </DropdownMenuTrigger>
  );
}

/** The row of a learner with a level: their belt and level after the name, said in its name. */
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

/**
 * The sidebar's end: one row that opens the account's menu, with whose it is (the 24px avatar and
 * the learner's name, or "Guest" for someone studying without an account yet) and their belt and
 * level, which Statistics above it opens. Its name says all three, the visible name first. A
 * visitor's Pricing and way in instead (`visitor`).
 */
export function SidebarAccount({ visitor }: { visitor: React.ReactNode }) {
  const learner = useLearnerSummary();

  if (learner.status === "visitor") {
    return visitor;
  }

  if (learner.status !== "ready") {
    return <PendingSidebarAccount visitor={visitor} />;
  }

  return <AccountRow summary={learner.summary} />;
}
