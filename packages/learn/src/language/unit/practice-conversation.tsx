"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { Button, FORWARD_ICON, buttonVariants } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { type CallLimit, useLiveLimit } from "../../_components/help-limit-notice";
import { KindDot } from "../../_components/kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../../_components/list-group";
import { SheetHeader } from "../../_components/sheet-header";
import { StatusRegion } from "../../_components/status-region";
import { GateWords } from "../../_components/subscribe-gate";
import { useFormatDuration } from "../../_utils/time-format";
import { useHeldSlot } from "../../_utils/use-held-slot";
import { WritingWait } from "../../generation/writing-wait";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallLimitWords } from "../conversation/call-limit-message";
import { CallReason } from "../conversation/conversation-parts";
import { type CallStartOutcome, useCallStart } from "../conversation/use-call-start";

function MinuteChips({
  choices,
  onChange,
  selected,
}: {
  choices: number[];
  onChange: (minutes: number) => void;
  selected: number;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const name = useId();

  return (
    <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1.5">
      <legend className="mb-2 text-sm font-medium">{t("Call length")}</legend>
      {choices.map((minutes) => (
        <label
          className={cn(
            "border-input flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
            "hover:bg-muted/50 has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
            "has-checked:border-foreground has-checked:bg-muted",
          )}
          key={minutes}
        >
          <input
            checked={selected === minutes}
            className="sr-only"
            name={name}
            onChange={() => onChange(minutes)}
            type="radio"
            value={minutes}
          />
          <span className="font-mono tabular-nums">{formatDuration(minutes)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function CallsPausedMessage({ className }: { className: string }) {
  const t = useExtracted();

  return (
    <CallReason className={className} role="alert" title={t("Calls are paused")}>
      <p className="text-muted-foreground text-sm text-pretty">
        {t({
          description:
            'Under the title "Calls are paused": the pause applies to every learner, not only this one.',
          message: "It's the same for everyone right now. Try again later.",
        })}
      </p>
    </CallReason>
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
  const limit = useLiveLimit(call.limit ?? conversation.limit);
  const slot = useHeldSlot<HTMLDivElement>(limit !== null);

  if (conversation.paused) {
    return <CallsPausedMessage className="pt-4" />;
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

  const isLocked = conversation.plusMinutes.includes(minutes);
  const lockedLine = t("Longer calls need a subscription");

  const choices = [...conversation.minutes, ...conversation.plusMinutes].toSorted(
    (first, second) => first - second,
  );

  return (
    <div className="flex flex-col gap-5">
      {choices.length > 0 && (
        <MinuteChips choices={choices} onChange={setMinutes} selected={minutes} />
      )}
      <div className="flex flex-col gap-2">
        {/* The line's space is kept for a Plus-only length and for a limit's words once it lifts,
            so the action under it never moves. */}
        <div
          className="grid text-sm text-pretty [&:not([data-held]):not(:has(>:not(:empty)))]:contents"
          ref={slot}
        >
          {conversation.plusMinutes.length > 0 && (
            <p aria-hidden="true" className="invisible col-start-1 row-start-1 font-medium">
              {lockedLine}
            </p>
          )}
          <StatusRegion className="col-start-1 row-start-1">
            {limit ? (
              <CallLimitWords limit={limit} />
            ) : (
              isLocked && <GateWords title={lockedLine} />
            )}
          </StatusRegion>
        </div>

        <CallSetupAction
          isLocked={isLocked}
          limit={limit}
          onStart={call.start}
          starting={call.isStarting}
        />
      </div>
      {call.failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("The call didn't start. Try again in a moment.")}
        </p>
      )}
      {call.paused && <CallsPausedMessage className="py-0" />}
    </div>
  );
}

/** Where Continue sits, the way on when a call can't start: the same box in every state. */
function CallSetupAction({
  isLocked,
  limit,
  onStart,
  starting,
}: {
  isLocked: boolean;
  limit: CallLimit | null;
  onStart: () => void;
  starting: boolean;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const actionClass = cn(buttonVariants({ size: "lg" }), "w-full");

  if (limit?.tier === "guest") {
    // Sign-up leaves the app's router, so it's a full page load.
    return (
      <a className={actionClass} href={routes.signUp}>
        {t("Create a free account")}
      </a>
    );
  }

  if (isLocked || limit?.tier === "free") {
    return (
      <LearnLink className={actionClass} href={routes.upgrade}>
        {t("Subscribe")}
      </LearnLink>
    );
  }

  return (
    // It opens the call's intro, whose button is the one that calls.
    <Button
      busy={starting}
      className="w-full"
      disabled={limit !== null}
      onClick={onStart}
      size="lg"
      {...FORWARD_ICON}
    >
      {t("Continue")}
    </Button>
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
        <SheetHeader>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DrawerTitle>{t("Practice a conversation")}</DrawerTitle>
            {character && (
              <DrawerDescription>
                {t("with {name} · {role}", { name: character.name, role: character.role })}
              </DrawerDescription>
            )}
          </div>
        </SheetHeader>
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

  // A submit, so a tap before the page hydrates opens the call's setup once it does.
  return (
    <>
      <form action={() => setOpen(true)} className="contents">
        <ListRowButton aria-haspopup="dialog" type="submit">
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
      </form>

      <PracticeCallSheet
        conversation={conversation}
        onOpenChange={setOpen}
        onStart={onStart}
        open={open}
      />
    </>
  );
}
