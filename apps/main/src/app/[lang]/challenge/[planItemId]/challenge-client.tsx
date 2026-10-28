"use client";

import { useRouter } from "@/i18n/navigation";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { requestQuestionWriting } from "@/lib/questions/question-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import {
  type ChallengeDestination,
  type ChallengeView,
} from "@zoonk/core/checkpoints/challenge-contract";
import { type ChallengeActions, ChallengeScreen } from "@zoonk/learn/challenge";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";
import {
  type ComponentProps,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  moveChallengeAction,
  startChallengeAction,
  undoChallengeMoveAction,
} from "./challenge-actions";

/** Where a challenge's block is played: the checkpoint or the mock exam screen. */
function getBlockHref({
  blockId,
  mock,
  search,
}: {
  blockId: string;
  mock: boolean;
  search: string;
}): `/checkpoint/${string}` | `/mock/${string}` {
  return mock ? `/mock/${blockId}${search}` : `/checkpoint/${blockId}${search}`;
}

type StartOutcome = Awaited<ReturnType<ChallengeActions["start"]>>;

/** The questions Start asked to have written: the run writing them, or why it can't now. */
type Writing = { generationId: string; kind: "writing" } | { kind: "refused"; limit: HelpLimit };

type ScreenProps = Omit<React.ComponentProps<typeof ChallengeScreen>, "writing">;

/** Asks the API to write the questions the challenge lacks (a POST from the learner's tap). */
function requestChallengeWriting(planItemId: string) {
  return requestQuestionWriting(`/challenges/${encodeURIComponent(planItemId)}/generations`);
}

/**
 * The intro while a run writes the challenge's questions; it starts once the run ends. A run that
 * wrote nothing ended too: the questions the bank already holds may be enough (`onEnded`), or the
 * failure stays with its way to try again.
 */
function WritingChallenge({
  generationId,
  onEnded,
  onReady,
  restart,
  screen,
}: {
  generationId: string;
  onEnded: () => void;
  onReady: () => void;
  restart: () => Promise<string | null>;
  screen: ScreenProps;
}) {
  const run = useWorkflowRun({ generationId, kind: "challengeQuestions", onReady, restart });
  const failed = run.failure === "generation";
  const end = useEffectEvent(onEnded);

  useEffect(() => {
    if (failed) {
      end();
    }
  }, [failed]);

  return <ChallengeScreen {...screen} writing={{ kind: "writing", run }} />;
}

/**
 * Wires the challenge's intro to its actions in the learner's timezone. Starting opens its block,
 * which continues to the session when the session opened the intro (`sessionId`), or to Today; a
 * bank short of its questions has them written first (the screen follows the run), then it
 * starts. A move or its undo goes on to the challenge on its day, since a dated plan item is a new
 * one once it moves.
 */
export function ChallengeClient({
  challenge,
  moved,
  sessionId,
}: {
  challenge: ChallengeView;
  moved: ComponentProps<typeof ChallengeScreen>["moved"];
  sessionId: string | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const { planItemId } = challenge;
  const search = sessionId ? `?${STUDY_SESSION_PARAM}=${sessionId}` : "";
  const page = useMemo(() => ({ locale, sessionId }), [locale, sessionId]);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [rereading, startRereading] = useTransition();

  const { actions, openWritten, startAfterWriting } = useMemo(() => {
    const open = (started: Pick<ChallengeDestination, "blockId" | "kind">): StartOutcome => {
      router.push(
        getBlockHref({ blockId: started.blockId, mock: started.kind === "mock", search }),
      );

      return "started";
    };

    // `afterWriting` once the learner waited for the run: it starts with what was written.
    const startOnce = async (afterWriting: boolean): Promise<StartOutcome | "questionsNeeded"> => {
      const started = await startChallengeAction(planItemId, getLocalTimeZone(), afterWriting);

      // Open can save a day without this offer, or with lessons or a challenge before it
      // (`earlierFirst`, the only result with a status), and today's study time can run out
      // meanwhile. Read the owning intro again, which says where it stands; none of these is a
      // failure the learner should keep retrying. Start stays busy until the page is read again.
      if (
        started === "notToday" ||
        started === "dailyLimitReached" ||
        (started && typeof started === "object" && "status" in started)
      ) {
        startRereading(() => router.refresh());
        return started;
      }

      // A kept intro can say Continue after another tab already finished this block.
      if (started === "blockFinished" && challenge.blockId) {
        return open({ blockId: challenge.blockId, kind: challenge.mock ? "mock" : "checkpoint" });
      }

      // Plus lapsed since the intro opened: the screen shows the lock now, and the page reloads
      // the challenge as it stands.
      if (started === "plusRequired") {
        router.refresh();
        return "plusRequired";
      }

      if (!started || typeof started === "string") {
        return started === "blockFinished" ? "failed" : (started ?? "failed");
      }

      return open(started);
    };

    // Written meanwhile (another run, or the session's preparation), it starts right away.
    const write = async (): Promise<StartOutcome> => {
      const result = await requestChallengeWriting(planItemId);

      if (result.status === "writing") {
        setWriting({ generationId: result.generationId, kind: "writing" });
        return "writing";
      }

      if (result.status === "refused") {
        setWriting({ kind: "refused", limit: result.limit });
        return "writing";
      }

      const again = result.status === "ready" ? await startOnce(true) : "failed";
      return again === "questionsNeeded" ? "failed" : again;
    };

    const start = async (afterWriting: boolean): Promise<StartOutcome> => {
      const outcome = await startOnce(afterWriting);
      return outcome === "questionsNeeded" ? write() : outcome;
    };

    const challengeActions: ChallengeActions = {
      // A move that went through goes on to the challenge's new day (the action redirects); a
      // mock the plan can't save the time for there says why.
      move: async () => {
        const outcome = await moveChallengeAction({ page, planItemId }, getLocalTimeZone());

        if (outcome === "notDone") {
          return "failed";
        }

        return typeof outcome === "object" ? outcome : "moved";
      },
      // A Start while a run is still writing waits for it, never opening on part of them.
      start: () => start(false),
      undoMove: async (changeId) =>
        (await undoChallengeMoveAction({ changeId, page, planItemId }, getLocalTimeZone())) !==
        "notDone",
    };

    return {
      actions: challengeActions,
      openWritten: () => startOnce(true),
      startAfterWriting: () => start(true),
    };
  }, [challenge.blockId, challenge.mock, page, planItemId, router, search, startRereading]);

  const hrefs = useMemo(
    () => ({
      exit: "/today",
      open: challenge.blockId
        ? getBlockHref({ blockId: challenge.blockId, mock: challenge.mock, search })
        : null,
    }),
    [challenge.blockId, challenge.mock, search],
  );

  const screen = { actions, challenge, hrefs, moved, rereading };

  if (writing?.kind !== "writing") {
    return <ChallengeScreen {...screen} writing={writing} />;
  }

  return (
    <WritingChallenge
      generationId={writing.generationId}
      // With nothing written, it opens on the questions the bank already held, if enough.
      onEnded={() => void openWritten()}
      // Once the run ends, it starts; anything else brings the intro back, whose Start says why.
      onReady={() =>
        void startAfterWriting().then((outcome) => {
          if (outcome !== "started" && outcome !== "writing") {
            setWriting(null);
          }
        })
      }
      restart={async () => {
        const again = await requestChallengeWriting(planItemId);
        return again.status === "writing" ? again.generationId : null;
      }}
      screen={screen}
    />
  );
}
