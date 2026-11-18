"use client";

import { type SpokenAudioState } from "@zoonk/learn/speech";
import { Bubble, BubbleContent } from "@zoonk/ui/components/bubble";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { LearnerBubble } from "@zoonk/ui/components/message";
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

  const text = (
    <>
      <span className="sr-only">{isThem ? t("They say:") : t("You said:")} </span>
      <span className="text-base font-medium">{line.text}</span>
      <span className="text-muted-foreground text-sm">{line.translation}</span>
    </>
  );

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

      {isThem ? (
        <Bubble variant="outline">
          <BubbleContent className="flex flex-col rounded-bl-sm">{text}</BubbleContent>
        </Bubble>
      ) : (
        <LearnerBubble className="flex flex-col">{text}</LearnerBubble>
      )}

      {canSpeak && isThem && (
        <ActivitySpeakButton
          className="ms-auto"
          label={t("Hear this line")}
          onClick={onSpeak}
          state={speechState}
        />
      )}
    </li>
  );
}

function ReplyContent({ isChecked, reply }: { isChecked: boolean; reply: DialogueReply }) {
  const t = useExtracted();

  return (
    <span>
      <PlayerChoiceSceneOptionText>{reply.text}</PlayerChoiceSceneOptionText>
      {isChecked && (
        <>
          <br />
          <span className="text-muted-foreground text-sm">{reply.translation}</span>
          <br />
        </>
      )}
      {isChecked && (
        <span className="text-sm leading-snug font-normal">
          {/* Every reply stays to say why, so the best one is named, whichever was picked. */}
          {reply.isBest && (
            <span className="text-success-text font-medium">{t("Best reply:")} </span>
          )}
          <LessonRichText text={reply.why} />
        </span>
      )}
    </span>
  );
}

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
        isChecked={isChecked}
        keepsEveryOption
        onSelect={(id) =>
          onAnswerChange(id === selectedId ? null : { ids: [id], kind: "selection" })
        }
        options={fields.replies.map((reply) => ({
          content: <ReplyContent isChecked={isChecked} reply={reply} />,
          isCorrect: expectedIds.includes(reply.id),
          key: reply.id,
        }))}
        selectedKey={selectedId}
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
