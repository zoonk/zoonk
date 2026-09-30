"use client";

import {
  type CallFeedback,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon, StarIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useExperienceMode } from "../../mode-provider";
import { TaskFrame, TaskMainLink } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";
import { SpeakButton } from "./conversation-parts";

const MAX_STARS = 3;

const SECTION =
  "in-data-[mode=fun]:fun-glass flex flex-col gap-2 rounded-2xl border p-4 in-data-[mode=fun]:border-transparent";

const LABEL =
  "text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-xs font-semibold tracking-wide uppercase";

type Result = NonNullable<LanguageConversationView["result"]>;

function useHeadline({
  conversation,
  result,
}: {
  conversation: LanguageConversationView;
  result: Result;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();

  if (conversation.kind !== "checkpoint") {
    return t("Call finished");
  }

  if (!result.passed) {
    return t("Not this time");
  }

  return mode === "fun" ? t("Boss beaten") : t("Checkpoint passed");
}

function Stars({ stars }: { stars: number }) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("{stars} of 3 stars", { stars: String(stars) })}
      className="flex gap-2"
      role="img"
    >
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <StarIcon
          aria-hidden="true"
          className={cn("size-9", index < stars ? "fill-fun-gold text-fun-gold" : "text-fun-fg3")}
          key={index}
        />
      ))}
    </div>
  );
}

function GoalsMet({ conversation }: { conversation: LanguageConversationView }) {
  const t = useExtracted();

  return (
    <section aria-labelledby="goals-met" className={SECTION}>
      <h2 className={LABEL} id="goals-met">
        {t("Goals of the call")}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {conversation.objectives.map((objective) => (
          <li className="flex items-start gap-2" key={objective.label}>
            <LineMarker>
              {objective.met ? (
                <CircleCheckIcon aria-hidden="true" className="text-success size-4" />
              ) : (
                <CircleIcon aria-hidden="true" className="text-muted-foreground size-4" />
              )}
            </LineMarker>
            <span lang={conversation.targetLanguage}>{objective.label}</span>
            <span className="sr-only">{objective.met ? t("done") : t("not yet")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A word to practice saying: how it sounds in the learner's spelling, a tip and its sound. */
function PronunciationTip({
  item,
  language,
}: {
  item: CallFeedback["pronunciation"][number];
  language: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <p>
          <span className="font-medium" lang={language}>
            {item.word}
          </span>{" "}
          <span className="text-muted-foreground">{item.respelling}</span>
        </p>
        <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">{item.tip}</p>
      </div>
      <SpeakButton language={language} text={item.word} />
    </li>
  );
}

function Feedback({ feedback, language }: { feedback: CallFeedback; language: string }) {
  const t = useExtracted();

  return (
    <>
      {feedback.wentWell.length > 0 && (
        <section aria-labelledby="went-well" className={SECTION}>
          <h2 className={LABEL} id="went-well">
            {t("Phrases you said well")}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {feedback.wentWell.map((phrase) => (
              <li className="flex items-start gap-2" key={phrase} lang={language}>
                <LineMarker>
                  <CircleCheckIcon aria-hidden="true" className="text-success size-4" />
                </LineMarker>
                {phrase}
              </li>
            ))}
          </ul>
        </section>
      )}

      {feedback.improve && (
        <section aria-labelledby="improve" className={SECTION}>
          <h2 className={LABEL} id="improve">
            {t("One thing to improve")}
          </h2>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground line-through" lang={language}>
                <span className="sr-only">{t("You said:")} </span>
                {feedback.improve.said}
              </p>
              <p className="font-medium" lang={language}>
                <span className="sr-only">{t("Better:")} </span>
                {feedback.improve.better}
              </p>
            </div>
            <SpeakButton language={language} text={feedback.improve.better} />
          </div>
          <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
            {feedback.improve.why}
          </p>
        </section>
      )}

      {feedback.pronunciation.length > 0 && (
        <section aria-labelledby="pronunciation" className={SECTION}>
          <h2 className={LABEL} id="pronunciation">
            {t("Words to practice saying")}
          </h2>
          <ul className="flex flex-col gap-3">
            {feedback.pronunciation.map((item) => (
              <PronunciationTip item={item} key={item.word} language={language} />
            ))}
          </ul>
        </section>
      )}

      <p className="text-center">{feedback.encouragement}</p>
    </>
  );
}

function NoFeedback({ spokenSeconds }: { spokenSeconds: number }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-center">
      {spokenSeconds === 0
        ? t("We didn't hear you this time. Try the call again when you can talk.")
        : t("Feedback isn't available for this call.")}
    </p>
  );
}

/**
 * After a call: whether it closed the unit, the goals met, the phrases said well, one thing to
 * improve with a better way to say it (and its sound), words to practice and Brain Power. Fun adds
 * stars and says "Boss beaten". A lost checkpoint costs nothing and comes back.
 */
export function ConversationResult({
  conversation,
  nextHref,
  result,
}: {
  conversation: LanguageConversationView;
  nextHref: string;
  result: Result;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();
  const headline = useHeadline({ conversation, result });
  const title = useConversationTitle(conversation);
  const feedback = result.feedback?.kind === "call" ? result.feedback : null;

  return (
    <TaskFrame
      exitHref={null}
      footer={<TaskMainLink href={nextHref}>{t("Continue")}</TaskMainLink>}
      headerTitle={title}
    >
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <p className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-lime text-xs font-semibold tracking-[0.18em] uppercase">
          {headline}
        </p>
        <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold text-balance">
          {conversation.title}
        </h1>
        {mode === "fun" && <Stars stars={result.stars} />}
        {result.brainPower > 0 && (
          <p className="in-data-[mode=fun]:fun-glass rounded-full px-3 py-1 text-sm font-medium">
            {t("+{points} Brain Power", { points: String(result.brainPower) })}
          </p>
        )}
        {conversation.kind === "checkpoint" && !result.passed && (
          <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
            {t("Nothing is lost: the call comes back so you can try again.")}
          </p>
        )}
      </div>

      <GoalsMet conversation={conversation} />

      {feedback ? (
        <Feedback feedback={feedback} language={conversation.targetLanguage} />
      ) : (
        <NoFeedback spokenSeconds={result.spokenSeconds} />
      )}
    </TaskFrame>
  );
}
