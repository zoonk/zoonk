"use client";

import { TOOL_SYSTEMS, type ToolChoice, type ToolSystem } from "@zoonk/core/plans/tools-contract";
import { type PlanToolView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { CircleCheckIcon, EyeIcon, WrenchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type Choice, ChoiceList } from "../onboarding/choice-list";
import { PlanFailedMessage } from "./plan-failed-message";
import { useSystemName } from "./use-system-name";
import { useToolChoice } from "./use-tool-choice";

function useToolChoices(): Choice<ToolChoice>[] {
  const t = useExtracted();

  return [
    {
      description: t("You'll practice on your own device."),
      icon: <CircleCheckIcon aria-hidden="true" />,
      label: t("I have it"),
      value: "have",
    },
    {
      description: t("A short lesson shows how, right before you need it."),
      icon: <WrenchIcon aria-hidden="true" />,
      label: t("I'll set it up"),
      value: "setup",
    },
    {
      description: t("Learn with examples. You won't practice on your own computer."),
      icon: <EyeIcon aria-hidden="true" />,
      label: t("No install"),
      value: "none",
    },
  ];
}

function SystemPicker({
  onChange,
  value,
}: {
  onChange: (system: ToolSystem) => void;
  value: ToolSystem | null;
}) {
  const t = useExtracted();
  const systemName = useSystemName();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("Your device")}</legend>
      <div className="flex flex-wrap gap-2">
        {TOOL_SYSTEMS.map((system) => (
          <Toggle
            className="aria-pressed:border-foreground h-11 rounded-full px-4 aria-pressed:font-semibold"
            key={system}
            onPressedChange={() => onChange(system)}
            pressed={value === system}
            variant="outline"
          >
            {systemName(system)}
          </Toggle>
        ))}
      </div>
    </fieldset>
  );
}

/** Keyed by the tool, so each opening starts from the learner's current answer. */
function ToolChoiceForm({ onClose, tool }: { onClose: () => void; tool: PlanToolView }) {
  const t = useExtracted();
  const choices = useToolChoices();
  const [choice, setChoice] = useState<ToolChoice | null>(tool.choice);
  const [system, setSystem] = useState<ToolSystem | null>(tool.system);
  const { choose, failed, isPending } = useToolChoice();
  const needsSystem = choice === "setup" && system === null;
  const canSave = Boolean(choice) && !needsSystem && !isPending;
  // Enter saves from anywhere in the sheet, such as right after a number key picked an answer.
  const saveRef = useEnterClick<HTMLButtonElement>({ enabled: canSave });

  const save = () => {
    if (choice && !needsSystem) {
      choose({ choice, system: choice === "setup" ? system : null, tools: [tool.name] }, onClose);
    }
  };

  return (
    <DrawerContent>
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <ChoiceList
          choices={choices}
          label={t("How will you use it?")}
          onChange={setChoice}
          value={choice}
        />

        {choice === "setup" && <SystemPicker onChange={setSystem} value={system} />}
        {failed && <PlanFailedMessage />}

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onClose} size="lg" type="button" variant="outline">
            {t("Cancel")}
          </Button>
          <Button disabled={!canSave} focusableWhenDisabled ref={saveRef} size="lg" type="submit">
            {t("Save")}
          </Button>
        </div>
      </form>
    </DrawerContent>
  );
}

/**
 * How the learner will use one tool: they have it, they'll set it up (then which device), or no
 * install, with what that path can't give said plainly.
 */
export function PlanToolSheet({
  onClose,
  tool,
}: {
  onClose: () => void;
  tool: PlanToolView | null;
}) {
  const t = useExtracted();

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={tool !== null}
    >
      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">{tool?.name}</DrawerTitle>
          <DrawerDescription>{t("How will you use it?")}</DrawerDescription>
        </DrawerHeader>

        {tool && <ToolChoiceForm key={tool.name} onClose={onClose} tool={tool} />}
      </DrawerPopup>
    </Drawer>
  );
}
