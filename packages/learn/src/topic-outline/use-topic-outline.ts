"use client";

import { type SkillOutline } from "@zoonk/core/lookahead/skill-outline-contract";
import { useEffect, useState, useTransition } from "react";
import { type OutlineLimit } from "../_components/help-limit-notice";
import { usePoll } from "../_utils/use-poll";
import { type TopicOutlineActions } from "./topic-outline-actions";

/** A topic's first chapter takes about half a minute; its lesson plan is read again this often. */
const POLL_MS = 4000;

/** What the sheet shows: the lesson plan as read, or why a tap didn't start it. */
export type TopicOutlineShown =
  | SkillOutline["status"]
  | "loading"
  | "refused"
  | "unavailable"
  | "unreachable";

/** Why the sheet shows no lesson plan: a tap refused by the learner's caps, or a failure. */
type TopicOutlineFailure = { limit?: OutlineLimit; shown: TopicOutlineShown };

/**
 * A far topic's lesson plan while its sheet is open: read once on opening (a GET, never AI), the
 * tap that asks for it (once at a time), then read again every few seconds while it's written.
 * `onLanded` runs once its chapters are in, for the page to show them in the plan.
 */
export function useTopicOutline({
  actions,
  onLanded,
  open,
  skillId,
}: {
  actions: TopicOutlineActions;
  onLanded: () => void;
  open: boolean;
  skillId: string;
}) {
  const [outline, setOutline] = useState<SkillOutline | null>(null);
  const [failure, setFailure] = useState<TopicOutlineFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const status = outline?.status ?? null;

  useEffect(() => {
    if (!open || outline) {
      return;
    }

    let current = true;

    void actions.read(skillId).then((read) => {
      if (current) {
        setOutline(read);
        setFailure(read ? null : { shown: "unreachable" });
      }
    });

    return () => {
      current = false;
    };
  }, [actions, open, outline, skillId]);

  const poll = usePoll({
    active: open && status === "writing",
    intervalMs: POLL_MS,
    key: skillId,
    onPoll: async () => {
      const read = await actions.read(skillId);

      if (!read) {
        throw new Error("The topic's lesson plan couldn't be read.");
      }

      if (read.status !== "writing") {
        setOutline(read);
        onLanded();
      }
    },
  });

  const request = () =>
    startTransition(async () => {
      const outcome = await actions.request(skillId);

      if (outcome.status === "refused") {
        setFailure({ limit: outcome.limit, shown: "refused" });
        return;
      }

      if (outcome.status === "failed" || outcome.status === "unavailable") {
        setFailure({ shown: outcome.status === "failed" ? "unreachable" : "unavailable" });
        return;
      }

      setFailure(null);

      if (outcome.status === "writing") {
        setOutline({ chapters: [], status: "writing" });
        return;
      }

      setOutline(await actions.read(skillId));
      onLanded();
    });

  const isStuck = poll.status === "failed" || poll.status === "timedOut";

  const shown: TopicOutlineShown = isStuck
    ? "unreachable"
    : (failure?.shown ?? status ?? "loading");

  return {
    chapters: outline?.chapters ?? [],
    isPending,
    limit: failure?.limit ?? null,
    request,
    /** After a failure: reading again when reading failed, else asking again. */
    retry: isStuck ? poll.restart : request,
    shown,
  };
}
