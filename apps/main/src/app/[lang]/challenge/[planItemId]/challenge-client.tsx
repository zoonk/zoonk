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

type Writing = { generationId: string; kind: "writing" } | { kind: "refused"; limit: HelpLimit };

type ScreenProps = Omit<React.ComponentProps<typeof ChallengeScreen>, "writing">;

function requestChallengeWriting(planItemId: string) {
  return requestQuestionWriting(`/challenges/${encodeURIComponent(planItemId)}/generations`);
}

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

    const startOnce = async (afterWriting: boolean): Promise<StartOutcome | "questionsNeeded"> => {
      const started = await startChallengeAction(planItemId, getLocalTimeZone(), afterWriting);

      // None of these is worth retrying: the intro, read again, says where it stands.
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

      if (started === "plusRequired") {
        router.refresh();
        return "plusRequired";
      }

      if (!started || typeof started === "string") {
        return started === "blockFinished" ? "failed" : (started ?? "failed");
      }

      return open(started);
    };

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
      move: async () => {
        const outcome = await moveChallengeAction({ page, planItemId }, getLocalTimeZone());

        if (outcome === "notDone") {
          return "failed";
        }

        return typeof outcome === "object" ? outcome : "moved";
      },
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
      onEnded={() => void openWritten()}
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
