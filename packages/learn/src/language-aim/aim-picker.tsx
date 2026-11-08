"use client";

import { type LanguageAim, isLanguageAim } from "@zoonk/core/language/aims";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { useIsMobile } from "@zoonk/ui/hooks/mobile";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { ChoiceList } from "../onboarding/choice-list";
import { useAimWords } from "./use-aim-words";

export type AimOption = { aim: LanguageAim; detail: string };

export function AimName({ aim }: { aim: string }) {
  const words = useAimWords();
  const label = words.label(aim);

  return (
    <>
      <span className="font-mono">{aim}</span>
      {label && ` · ${label}`}
    </>
  );
}

/** A tap, a number key or Enter on the highlighted aim picks it; the arrow keys only move. */
export function AimChoices({
  numberKeys = true,
  onPick,
  options,
  pending,
  value,
}: {
  /** Off where the choices share the screen with other controls. */
  numberKeys?: boolean;
  onPick: (aim: LanguageAim) => void;
  options: readonly AimOption[];
  pending: boolean;
  value: string | null;
}) {
  const words = useAimWords();
  const saved = isLanguageAim(value) ? value : null;
  const [highlighted, setHighlighted] = useState(saved);
  const [shownSaved, setShownSaved] = useState(saved);

  // An undo or another screen's change moves the saved aim, and the highlight follows it.
  if (shownSaved !== saved) {
    setShownSaved(saved);
    setHighlighted(saved);
  }

  return (
    <ChoiceList
      choices={options.map((option) => ({
        description: option.detail,
        label: <AimName aim={option.aim} />,
        value: option.aim,
      }))}
      label={words.title}
      numberKeys={numberKeys}
      onChange={setHighlighted}
      onPick={onPick}
      pickOnEnter
      readOnly={pending}
      value={highlighted}
    />
  );
}

/** A sheet on phones and a popover from its trigger on wider screens; picking applies and closes. */
export function AimPicker({
  children,
  description,
  onPick,
  options,
  trigger,
  value,
}: {
  /** What the trigger shows; `trigger` is the element it's drawn as. */
  children: React.ReactNode;
  description: string | null;
  /** False when it couldn't be saved, which keeps the choices open. */
  onPick: (aim: LanguageAim) => Promise<boolean>;
  options: readonly AimOption[];
  trigger: React.ReactElement;
  value: string | null;
}) {
  const t = useExtracted();
  const isPhone = useIsMobile();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const title = t("How far do you want to go?");

  const pick = (aim: LanguageAim) => {
    if (aim === value) {
      setOpen(false);
      return;
    }

    startSaving(async () => {
      setFailed(false);
      const { data: saved } = await safeAsync(() => onPick(aim));
      setFailed(!saved);

      if (saved) {
        setOpen(false);
      }
    });
  };

  const choices = (
    <>
      <AimChoices onPick={pick} options={options} pending={isSaving} value={value} />
      {failed && <ChangeSaveError />}
    </>
  );

  if (isPhone) {
    return (
      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerTrigger render={trigger}>{children}</DrawerTrigger>
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <DrawerContent className="flex flex-col gap-3 pt-2">{choices}</DrawerContent>
        </DrawerPopup>
      </Drawer>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-3">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {description && <PopoverDescription>{description}</PopoverDescription>}
        </PopoverHeader>
        {choices}
      </PopoverContent>
    </Popover>
  );
}
