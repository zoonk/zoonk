"use client";

import { LevelLink, PendingBarEnd } from "@/app/[lang]/(app)/(learn)/_components/learn-bar-end";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { UserAvatarMenu } from "./user-avatar-menu";

export function CatalogBarContent({ visitor }: { visitor: React.ReactNode }) {
  const learner = useLearnerSummary();

  if (learner.status === "visitor") {
    return (
      <div className="**:data-[slot=back-link]:text-foreground contents">
        <LearnSectionBar back={{ href: "/", label: "Zoonk" }} listed="visitor" phoneEnd={visitor} />
      </div>
    );
  }

  return (
    <LearnSectionBar
      back={{ href: "/today" }}
      listed="visitor"
      phoneEnd={
        learner.status === "ready" ? (
          <>
            {learner.summary.level && <LevelLink level={learner.summary.level} />}
            <UserAvatarMenu />
          </>
        ) : (
          <PendingBarEnd visitor={visitor} />
        )
      }
      root
    />
  );
}
