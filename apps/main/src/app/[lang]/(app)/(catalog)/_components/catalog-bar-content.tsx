"use client";

import { LevelLink, PendingBarEnd } from "@/app/[lang]/(app)/(learn)/_components/learn-bar-end";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";
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
        listed="visitor"
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
            <>
              {learner.summary.level && <LevelLink level={learner.summary.level} />}
              <UserAvatarMenu />
            </>
          ) : (
            <PendingBarEnd visitor={visitor} />
          )}
        </PhoneEnd>
      }
      listed="visitor"
      title={t("Explore courses")}
    />
  );
}
