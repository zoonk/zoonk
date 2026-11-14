"use client";

import { VisitorLook } from "@/components/learner/visitor-look";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";
import { PendingAccountAvatar } from "./user-avatar";
import { UserAvatarMenu } from "./user-avatar-menu";

/** From `lg` the sidebar holds the way in and the account, so the bar's end is a phone's. */
function PhoneEnd({ children }: { children: React.ReactNode }) {
  return <div className="contents lg:hidden">{children}</div>;
}

export function CatalogBarContent({ visitor }: { visitor: React.ReactNode }) {
  const t = useExtracted();
  const learner = useLearnerSummary();

  if (learner.status === "visitor") {
    return (
      <LearnSectionBar
        back={{ href: "/", label: t("Home") }}
        end={<PhoneEnd>{visitor}</PhoneEnd>}
        root
        title={t("Explore courses")}
      />
    );
  }

  return (
    <LearnSectionBar
      back={{ href: "/today", label: t("Today") }}
      end={
        <PhoneEnd>
          {learner.status === "ready" ? (
            <LearnAvatarBelt color={learner.summary.level?.color ?? null}>
              <UserAvatarMenu includeSearch />
            </LearnAvatarBelt>
          ) : (
            <>
              <VisitorLook>{visitor}</VisitorLook>
              <PendingAccountAvatar className="size-7" />
            </>
          )}
        </PhoneEnd>
      }
      root
      title={t("Explore courses")}
    />
  );
}
