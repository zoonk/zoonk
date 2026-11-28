"use client";

import {
  type PronunciationAnswerGrade,
  type PronunciationReviewsView,
  type PronunciationRoundResult,
} from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@zoonk/ui/components/empty";
import { RotateCcwIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FeedbackVerdict } from "../../_components/feedback-panel";
import { MomentReadouts } from "../../_components/moment-readouts";
import { AnswersSaveError } from "../../_components/save-error";
import { TaskHeaderMenu, TaskHeaderTitle } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { DayMoment } from "../../session/day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "../../session/moment-ceremony";
import { MomentHeader } from "../../session/moment-header";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../../shell/task-frame";
import { RecordButton } from "../../speech/record-button";
import { RecordCue } from "../../speech/record-cue";
import { type RecordProblem, useRecordNote } from "../../speech/record-note";
import { PronunciationWord, useWordRecorder } from "./pronunciation-word-card";
import { type PronunciationRoundActions, usePronunciationRound } from "./use-pronunciation-round";

export type {
  PronunciationAnswerOutcome,
  PronunciationRoundActions,
} from "./use-pronunciation-round";

const PERCENT = 100;

function GradeNote({ grade }: { grade: PronunciationAnswerGrade }) {
  const t = useExtracted();

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-1" role="status">
      {grade.isCorrect ? (
        <FeedbackVerdict tone="right">{t("That sounded right")}</FeedbackVerdict>
      ) : (
        <p className="font-semibold">{t("We heard “{heard}”", { heard: grade.transcript })}</p>
      )}
    </div>
  );
}

function RoundResult({
  buddy,
  result,
}: {
  buddy?: LearnBuddy | null;
  result: PronunciationRoundResult | null;
}) {
  const t = useExtracted();

  return (
    <>
      <MomentHeader title={result ? t("Practice done") : t("Nothing said this time")}>
        {result && (
          <MomentReadouts
            brainPower={result.brainPower}
            score={{ answered: result.total, correct: result.correct, spoken: true }}
          />
        )}
      </MomentHeader>

      {result && (
        <DayMoment
          buddy={buddy}
          ceremony={result.ceremony}
          missionMoment={result.missionMoment}
          reached={result.reached}
        />
      )}
    </>
  );
}

function WordMenu({ disabled, onSkip }: { disabled: boolean; onSkip: () => void }) {
  const t = useExtracted();

  return (
    <TaskHeaderMenu>
      <DropdownMenuItem disabled={disabled} onClick={onSkip}>
        <SkipForwardIcon aria-hidden="true" />
        {t("Skip")}
      </DropdownMenuItem>
    </TaskHeaderMenu>
  );
}

function useWordTake({
  mic,
  pending,
  ready,
}: {
  mic: ReturnType<typeof useWordRecorder>;
  pending: boolean;
  ready: { notice: RecordProblem | null } | null;
}) {
  const t = useExtracted();
  const on = mic.recorder.status === "acquiring" || mic.recorder.status === "recording";

  const note = useRecordNote({
    checking: pending,
    problem: ready?.notice,
    recording: on,
    unavailable: mic.available
      ? null
      : t("We can't use your microphone, so skip this word."),
  });

  const cue =
    ready && mic.available ? <RecordCue checking={pending} recorder={mic.recorder} /> : null;

  return { cue, note, on };
}

export function PronunciationReviewScreen({
  actions,
  buddy,
  exitHref,
  renderCeremony,
  reviews,
}: {
  actions: PronunciationRoundActions;
  buddy?: LearnBuddy | null;
  exitHref: string;
  renderCeremony?: MomentCeremony;
  reviews: PronunciationReviewsView;
}) {
  const t = useExtracted();
  const round = usePronunciationRound({ actions, words: reviews.words });
  const mic = useWordRecorder(round.record);
  const { current, step } = round;
  const total = round.segments.length;
  const ready = step.kind === "word" && step.word.kind === "ready" ? step.word : null;
  const take = useWordTake({ mic, pending: round.isPending, ready });

  if (step.kind === "result" || !current) {
    const result = step.kind === "result" ? step.result : null;

    return (
      <MomentAfterCeremony moments={result ?? null} render={renderCeremony}>
        <TaskFrame
          exitHref={exitHref}
          exitToApp
          footer={
            <TaskActions>
              <TaskMainLink href={exitHref} toApp>
                {total === 0 ? t("Today") : t("Done")}
              </TaskMainLink>
            </TaskActions>
          }
          headerTitle={<TaskHeaderTitle title={t("Say it again")} />}
        >
          {total === 0 ? (
            <Empty className="py-6" role="status">
              <EmptyHeader>
                <EmptyTitle>{t("No words to say again today")}</EmptyTitle>
                <EmptyDescription>
                  {t("Words that were hard to say come back here to practice.")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <RoundResult buddy={buddy} result={result} />
          )}
        </TaskFrame>
      </MomentAfterCeremony>
    );
  }

  const graded = step.word.kind === "graded" ? step.word.grade : null;
  const isLast = round.index + 1 === total;

  const position = t("Word {current, number} of {total, number}", {
    current: round.index + 1,
    total,
  });

  return (
    <TaskFrame
      exitHref={exitHref}
      exitToApp
      footer={
        <>
          {round.failures > 0 && !round.isPending && (
            <AnswersSaveError failures={round.failures} onRetry={round.retryFinish} />
          )}
          <WordActions
            available={mic.available}
            graded={graded}
            isLast={isLast}
            mic={mic.recorder}
            round={round}
          />
        </>
      }
      footerNote={ready && take.note}
      headerEnd={
        !graded &&
        mic.available && <WordMenu disabled={round.isPending || take.on} onSkip={round.next} />
      }
      headerTitle={<TaskHeaderTitle title={t("Say it again")} />}
      progress={{
        label: position,
        segments: round.segments,
        value: ((round.index + (graded ? 1 : 0)) / total) * PERCENT,
      }}
    >
      <PronunciationWord
        cue={take.cue}
        key={current.id}
        language={reviews.language}
        recording={take.on}
        word={current}
      />
      {graded && <GradeNote grade={graded} />}
    </TaskFrame>
  );
}

function WordActions({
  available,
  graded,
  isLast,
  mic,
  round,
}: {
  available: boolean;
  graded: PronunciationAnswerGrade | null;
  isLast: boolean;
  mic: ReturnType<typeof useWordRecorder>["recorder"];
  round: ReturnType<typeof usePronunciationRound>;
}) {
  const t = useExtracted();

  if (graded) {
    return (
      <TaskActions>
        {!graded.isCorrect && (
          <Button className="shrink-0" onClick={round.tryAgain} size="lg" variant="outline">
            <RotateCcwIcon aria-hidden="true" />
            {t("Try again")}
          </Button>
        )}
        <TaskMainButton busy={round.isPending} onClick={round.next}>
          {isLast ? t("See result") : t("Continue")}
        </TaskMainButton>
      </TaskActions>
    );
  }

  if (!available) {
    return (
      <TaskActions>
        <TaskMainButton busy={round.isPending} onClick={round.next}>
          {t("Skip")}
        </TaskMainButton>
      </TaskActions>
    );
  }

  return (
    <TaskActions>
      <RecordButton
        busy={mic.status === "acquiring" || round.isPending}
        disabled={round.isPending}
        elapsedMs={mic.elapsedMs}
        onStart={() => void mic.start()}
        onStop={mic.stop}
        recording={mic.status === "recording"}
      />
    </TaskActions>
  );
}
