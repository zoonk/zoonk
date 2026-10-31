"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { DrawerCloseButton } from "../../_components/details-drawer";
import { KindDot } from "../../_components/kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../../_components/list-group";
import { PlusMark, PlusNotice } from "../../_components/plus-lock";
import { useFormatDuration } from "../../_utils/time-format";
import { WritingWait } from "../../generation/writing-wait";
import { CallLimitMessage } from "../conversation/call-limit-message";
import { CallOffMessage } from "../conversation/conversation-parts";
import { type CallStartOutcome, useCallStart } from "../conversation/use-call-start";

type LengthChoice = { locked: boolean; minutes: number };

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
  const formatDuration = useFormatDuration();
  const name = useId();
  const hasLocked = choices.some((choice) => choice.locked);

  return (
    <fieldset className={cn("grid gap-1.5", hasLocked ? "grid-cols-2" : "grid-cols-4")}>
      <legend className="mb-2 text-sm font-medium">{t("Call length")}</legend>
      {choices.map((choice) => (
        <label
          className={cn(
            "border-input rounded-option flex min-h-11 cursor-pointer items-center justify-center gap-2 border px-3 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
            "hover:bg-muted/50 has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
            "has-checked:border-foreground has-checked:bg-muted",
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
          <span className="font-mono tabular-nums">{formatDuration(choice.minutes)}</span>
          {choice.locked && <PlusMark />}
        </label>
      ))}
    </fieldset>
  );
}

function CallsPausedMessage({ className }: { className: string }) {
  const t = useExtracted();

  return (
    <CallOffMessage className={className} title={t("Calls are paused")}>
      <p className="text-muted-foreground text-sm text-pretty">
        {t({
          description:
            'Under the title "Calls are paused": the pause applies to every learner, not only this one.',
          message: "It's the same for everyone right now. Try again later.",
        })}
      </p>
    </CallOffMessage>
  );
}

function CallSetup({
  conversation,
  onStart,
}: {
  conversation: LanguageUnitView["conversation"];
  onStart: (minutes: number) => Promise<CallStartOutcome>;
}) {
  const t = useExtracted();
  const [minutes, setMinutes] = useState(conversation.defaultMinutes);
  const call = useCallStart({ onStart: () => onStart(minutes) });

  if (conversation.paused) {
    return <CallsPausedMessage className="py-4" />;
  }

  if (call.writing) {
    return (
      <WritingWait
        hint={t("Your call opens as soon as it's ready.")}
        kind="conversationCall"
        writing={call.writing}
      />
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
        <Button className="w-full" disabled={call.isStarting} onClick={call.start} size="lg">
          <PhoneIcon aria-hidden="true" />
          {call.isStarting ? t("Starting…") : t("Start the call")}
        </Button>
      )}
      {call.failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("The call didn't start. Try again in a moment.")}
        </p>
      )}
      {call.paused && <CallsPausedMessage className="py-0" />}
    </div>
  );
}

export function PracticeCallSheet({
  conversation,
  onOpenChange,
  onStart,
  open,
}: {
  conversation: LanguageUnitView["conversation"];
  onOpenChange: (open: boolean) => void;
  onStart: (minutes: number) => Promise<CallStartOutcome>;
  open: boolean;
}) {
  const t = useExtracted();
  const { character } = conversation;

  const start = async (minutes: number) => {
    const started = await onStart(minutes);

    if (started === true) {
      // The router preserves this page: returning opens a fresh setup, never its pending start.
      onOpenChange(false);
    }

    return started;
  };

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-start gap-3">
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
          <DrawerCloseButton />
        </DrawerHeader>
        <DrawerContent className="pt-3">
          {open && <CallSetup conversation={conversation} onStart={start} />}
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

export function PracticeConversation({
  conversation,
  onStart,
}: {
  conversation: LanguageUnitView["conversation"];
  onStart: (minutes: number) => Promise<CallStartOutcome>;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const { character } = conversation;

  return (
    <>
      <ListRowButton aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <ListRowLeading>
          <KindDot kind="conversation" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Practice a conversation")}</ListRowTitle>
          {conversation.paused ? (
            <ListRowDescription>{t("Calls are paused")}</ListRowDescription>
          ) : (
            character && (
              <ListRowDescription>
                {t("with {name} · {role}", { name: character.name, role: character.role })}
              </ListRowDescription>
            )
          )}
        </ListRowContent>
      </ListRowButton>

      <PracticeCallSheet
        conversation={conversation}
        onOpenChange={setOpen}
        onStart={onStart}
        open={open}
      />
    </>
  );
}
