"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MessageCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { usePrimaryVariant } from "../../_utils/fun-primary";
import { GenerationWait } from "../../generation/generation-wait";
import { useCallStart } from "../conversation/use-call-start";
import { LanguageCard } from "../language-card";
import { UnitCardHeader } from "./unit-sections";

function MinuteChips({
  minutes,
  onChange,
  selected,
}: {
  minutes: number[];
  onChange: (minutes: number) => void;
  selected: number;
}) {
  const t = useExtracted();
  const name = useId();

  return (
    <fieldset className="grid grid-cols-4 gap-1.5">
      <legend className="sr-only">{t("Call length")}</legend>
      {minutes.map((option) => (
        <label
          className={cn(
            "bg-secondary text-secondary-foreground flex min-h-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent text-sm font-medium tabular-nums",
            "has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
            "has-checked:border-foreground has-checked:bg-background",
            "in-data-[mode=fun]:bg-fun-soft in-data-[mode=fun]:text-fun-fg in-data-[mode=fun]:has-checked:border-fun-accent-lime",
          )}
          key={option}
        >
          <input
            checked={selected === option}
            className="sr-only"
            name={name}
            onChange={() => onChange(option)}
            type="radio"
            value={option}
          />
          {t("{minutes, number} min", { minutes: option })}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * "Practice a conversation": a call with the unit's character, 1 to 5 minutes, at the learner's
 * speaking level. The host starts it and opens the call; false means it didn't start. The unit's
 * call is written once per level for every learner, so the first learner at a level waits for it
 * to be written, and the card shows that until it opens.
 */
export function PracticeConversation({
  conversation,
  onStart,
}: {
  conversation: LanguageUnitView["conversation"];
  onStart: (minutes: number) => Promise<boolean>;
}) {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const [minutes, setMinutes] = useState(conversation.defaultMinutes);
  const call = useCallStart({ onStart: () => onStart(minutes), step: "writeCall" });
  const { character } = conversation;

  return (
    <LanguageCard aria-labelledby="unit-conversation">
      <UnitCardHeader
        aside={character ? t("with {name}", { name: character.name }) : null}
        icon={MessageCircleIcon}
        id="unit-conversation"
        title={t("Practice a conversation")}
      />

      {call.run ? (
        <GenerationWait className="pt-2" kind="conversationCall" run={call.run}>
          {call.run.status !== "failed" && (
            <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
              {t("Your call opens as soon as it's ready.")}
            </p>
          )}
        </GenerationWait>
      ) : (
        <>
          <MinuteChips minutes={conversation.minutes} onChange={setMinutes} selected={minutes} />

          <Button
            disabled={call.isStarting}
            onClick={call.start}
            size="lg"
            variant={primaryVariant}
          >
            {call.isStarting ? t("Starting…") : t("Start the call")}
          </Button>

          {call.failed && (
            <p className="text-destructive text-sm" role="alert">
              {t("The call didn't start. Try again in a moment.")}
            </p>
          )}
        </>
      )}
    </LanguageCard>
  );
}
