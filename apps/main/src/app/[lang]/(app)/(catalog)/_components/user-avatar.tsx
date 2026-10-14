"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import { User } from "lucide-react";

/**
 * The learner's photo or initial. A guest has no name of their own yet (auth calls them
 * "Anonymous"), so they get the plain person icon: their `name` is left out.
 */
export function UserAvatar({ image, name }: { image?: string | null; name?: string | null }) {
  const fallback = name?.[0] || <User size={16} />;

  return (
    <Avatar className="focus-visible:ring-ring size-full cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2">
      <AvatarImage src={image || undefined} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

/** The signed-in learner's (or guest's) avatar, from the learner summary. */
export function LearnerAvatar() {
  const learner = useLearnerSummary();

  if (learner.status !== "ready") {
    return <UserAvatar />;
  }

  const { account, identity } = learner.summary;

  return (
    <UserAvatar
      image={account.image}
      name={identity.isAnonymous ? null : account.name || account.email}
    />
  );
}
