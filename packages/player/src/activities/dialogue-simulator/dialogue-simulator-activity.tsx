"use client";

import { type SpokenAudioState } from "@zoonk/learn/speech";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { MapPin, UserRound } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySpeakButton } from "../_components/activity-speak-button";
import { expectedInteraction } from "../_utils/activity-expected";
import { useActivitySpeech } from "../_utils/use-activity-speech";
import { type ActivityRendererProps } from "../activity-renderer";

type DialogueProps = ActivityRendererProps<"dialogueSimulator">;
type DialogueFields = DialogueProps["content"]["fields"];
type DialogueLine = DialogueFields["lines"][number];
type DialogueReply = DialogueFields["replies"][number];

function ChatLine({
  canSpeak,
  line,
  onSpeak,
  speechState,
}: {
  canSpeak: boolean;
  line: DialogueLine;
  onSpeak: () => void;
  speechState: SpokenAudioState;
}) {
  const t = useExtracted();
  const isThem = line.speaker === "them";

  return (
    <li className={cn("flex items-end gap-2.5", !isThem && "flex-row-reverse")}>
      {isThem && (
        <span
          aria-hidden="true"
          className="bg-viz-secondary-soft text-viz-secondary flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <UserRound className="size-4" />
        </span>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-col rounded-2xl px-3.5 py-2.5",
          isThem ? "bg-background rounded-bl-md shadow-xs" : "bg-viz-accent-soft rounded-br-md",
        )}
      >
        <span className="sr-only">{isThem ? t("They say:") : t("You said:")} </span>
        <span className="text-base font-medium">{line.text}</span>
        <span className="text-muted-foreground text-sm">{line.translation}</span>
      </div>

      {canSpeak && isThem && (
        <ActivitySpeakButton label={t("Hear this line")} onClick={onSpeak} state={speechState} />
      )}
    </li>
  );
}

/** A reply as an option: the words, and after the check what they mean and why they fit or not. */
function ReplyContent({ isChecked, reply }: { isChecked: boolean; reply: DialogueReply }) {
  return (
    <span className="flex flex-col gap-0.5">
      <PlayerChoiceSceneOptionText>{reply.text}</PlayerChoiceSceneOptionText>
      {isChecked && <span className="text-sm opacity-90">{reply.translation}</span>}
      {isChecked && (
        <span className="text-foreground text-sm leading-snug">
          <LessonRichText text={reply.why} />
        </span>
      )}
    </span>
  );
}

function replyResult({
  expectedIds,
  reply,
  selectedId,
}: {
  expectedIds: readonly string[];
  reply: DialogueReply;
  selectedId: string | null;
}): "correct" | "incorrect" | null {
  if (expectedIds.includes(reply.id)) {
    return "correct";
  }

  return reply.id === selectedId ? "incorrect" : null;
}

/**
 * A real conversation in the target language: the lines so far (each with its meaning and a
 * voice), then replies to choose from. The best reply is the answer; after the check every reply
 * shows what it means and why it fits the moment or doesn't.
 */
export function DialogueSimulatorActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: DialogueProps) {
  const t = useExtracted();
  const { fields } = content;
  const speech = useActivitySpeech(fields.language);
  const isChecked = phase === "checked";
  const selectedId = answer?.kind === "selection" ? (answer.ids[0] ?? null) : null;
  const canSpeak = speech.isAvailable;
  const best = fields.replies.find((reply) => reply.isBest);

  const expectedIds = expectedInteraction(expected, "selection")?.ids ?? [];

  function handleSelect(index: number) {
    const reply = fields.replies[index];

    if (isChecked || !reply) {
      return;
    }

    onAnswerChange(reply.id === selectedId ? null : { ids: [reply.id], kind: "selection" });
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <LineMarker>
            <MapPin aria-hidden="true" className="size-3.5" />
          </LineMarker>
          {fields.scene}
        </p>

        <ol aria-label={t("The conversation so far")} className="flex flex-col gap-3">
          {fields.lines.map((line, index) => (
            <ChatLine
              canSpeak={canSpeak}
              key={`${line.speaker}-${line.text}`}
              line={line}
              onSpeak={() => speech.toggle(`line-${String(index)}`, [line.text])}
              speechState={speech.stateFor(`line-${String(index)}`)}
            />
          ))}
        </ol>
      </div>

      <PlayerChoiceSceneOptions
        ariaLabel={t("Your reply")}
        keyboardEnabled={!isChecked}
        onSelect={handleSelect}
        options={fields.replies.map((reply) => ({
          content: <ReplyContent isChecked={isChecked} reply={reply} />,
          disabled: isChecked,
          isDimmed: !isChecked && selectedId !== null && selectedId !== reply.id,
          isSelected: selectedId === reply.id,
          key: reply.id,
          resultState: isChecked ? replyResult({ expectedIds, reply, selectedId }) : null,
        }))}
      />

      {isChecked && canSpeak && best && (
        <div className="flex items-center gap-2">
          <ActivitySpeakButton
            label={t("Hear the best reply")}
            onClick={() => speech.toggle("best", [best.text])}
            state={speech.stateFor("best")}
          />
          <span className="text-muted-foreground text-sm">{t("Hear the best reply")}</span>
        </div>
      )}

      <ActivityTextAlternative>
        {t("A conversation: {scene}. Choose the reply that fits.", { scene: fields.scene })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
