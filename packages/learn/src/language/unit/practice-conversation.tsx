"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { KindTile } from "../../_components/kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../../_components/list-group";
import { PlusMark, PlusNotice } from "../../_components/plus-lock";
import { GenerationWait } from "../../generation/generation-wait";
import { CallLimitMessage } from "../conversation/call-limit-message";
import { useCallStart } from "../conversation/use-call-start";

type LengthChoice = { locked: boolean; minutes: number };

/** The lengths that fit, and the longer ones that come with Plus, in order. */
function toLengthChoices(conversation: LanguageUnitView["conversation"]): LengthChoice[] {
  return [
    ...conversation.minutes.map((minutes) => ({ locked: false, minutes })),
    ...conversation.plusMinutes.map((minutes) => ({ locked: true, minutes })),
  ].toSorted((first, second) => first.minutes - second.minutes);
}

function MinuteChips({
  choices,
  onChange,
  selected,
}: {
  choices: LengthChoice[];
  onChange: (minutes: number) => void;
  selected: number;
}) {
  const t = useExtracted();
  const name = useId();
  const hasLocked = choices.some((choice) => choice.locked);

  return (
    <fieldset className={cn("grid gap-1.5", hasLocked ? "grid-cols-2" : "grid-cols-4")}>
      <legend className="mb-2 text-sm font-medium">{t("Call length")}</legend>
      {choices.map((choice) => (
        <label
          className={cn(
            "bg-secondary text-secondary-foreground flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-transparent px-3 text-sm font-medium tabular-nums",
            "has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
            "has-checked:border-foreground has-checked:bg-background",
          )}
          key={choice.minutes}
        >
          <input
            checked={selected === choice.minutes}
            className="sr-only"
            name={name}
            onChange={() => onChange(choice.minutes)}
            type="radio"
            value={choice.minutes}
          />
          {t("{minutes, number} min", { minutes: choice.minutes })}
          {choice.locked && <PlusMark />}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The sheet's body: how long the call is and "Start the call", or the wait while it's written.
 * Only the lengths that fit what's left of the learner's call time are offered; the longer ones
 * Plus holds show locked, and picking one shows what Plus unlocks in place of the start. Once no
 * length fits, the sheet says until when calls come back.
 */
function CallSetup({
  conversation,
  onStart,
}: {
  conversation: LanguageUnitView["conversation"];
  onStart: (minutes: number) => Promise<boolean>;
}) {
  const t = useExtracted();
  const [minutes, setMinutes] = useState(conversation.defaultMinutes);
  const call = useCallStart({ onStart: () => onStart(minutes), step: "writeCall" });

  if (call.run) {
    return (
      <GenerationWait kind="conversationCall" run={call.run}>
        {call.run.status !== "failed" && (
          <p className="text-muted-foreground text-sm">
            {t("Your call opens as soon as it's ready.")}
          </p>
        )}
      </GenerationWait>
    );
  }

  if (conversation.limit) {
    return <CallLimitMessage className="py-4" limit={conversation.limit} />;
  }

  const isLocked = conversation.plusMinutes.includes(minutes);

  return (
    <div className="flex flex-col gap-5">
      <MinuteChips
        choices={toLengthChoices(conversation)}
        onChange={setMinutes}
        selected={minutes}
      />
      {isLocked ? (
        <PlusNotice inset>{t("Longer calls come with Plus.")}</PlusNotice>
      ) : (
        <Button className="h-12 w-full text-base" disabled={call.isStarting} onClick={call.start}>
          {call.isStarting ? t("Starting…") : t("Start the call")}
        </Button>
      )}
      {call.failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("The call didn't start. Try again in a moment.")}
        </p>
      )}
    </div>
  );
}

/**
 * "Practice a conversation": a row of the unit's practice list that opens a sheet for the call with the unit's character,
 * a few minutes at the learner's speaking level. The host starts it and opens the call; false
 * means it didn't start. The unit's call is written once per level for every learner, so the
 * first learner at a level waits for it in the sheet until it opens.
 */
export function PracticeConversation({
  conversation,
  onStart,
}: {
  conversation: LanguageUnitView["conversation"];
  onStart: (minutes: number) => Promise<boolean>;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const { character } = conversation;

  return (
    <>
      <ListRowButton aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <ListRowLeading>
          <KindTile kind="conversation" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Practice a conversation")}</ListRowTitle>
          {character && (
            <ListRowDescription>
              {t("with {name} · {role}", { name: character.name, role: character.role })}
            </ListRowDescription>
          )}
        </ListRowContent>
      </ListRowButton>

      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerPopup>
          <DrawerHeader className="flex-row items-start gap-3">
            <KindTile kind="conversation" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DrawerTitle className="text-xl font-semibold">
                {t("Practice a conversation")}
              </DrawerTitle>
              {character && (
                <DrawerDescription>
                  {t("with {name} · {role}", { name: character.name, role: character.role })}
                </DrawerDescription>
              )}
            </div>
            <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Close")}</span>
            </DrawerClose>
          </DrawerHeader>
          <DrawerContent className="pt-3">
            <CallSetup conversation={conversation} onStart={onStart} />
          </DrawerContent>
        </DrawerPopup>
      </Drawer>
    </>
  );
}
