"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useSystemName } from "./use-system-name";

type ToolChoiceOperation = Extract<PlanOperation, { kind: "setTools" }>["tools"];

/** A tool answer from the "You'll use" card: "A lesson to set up Python on Windows comes first". */
export function useToolSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const systemName = useSystemName();

  return (tools: ToolChoiceOperation): string => {
    const names = format.list(
      tools.map((tool) => tool.name),
      { type: "conjunction" },
    );

    const [first] = tools;

    if (first?.choice === "setup" && first.system) {
      return t("A lesson to set up {tools} on {device} comes before you need it.", {
        device: systemName(first.system),
        tools: names,
      });
    }

    return first?.choice === "have"
      ? t("You have {tools}, so there's nothing to set up.", { tools: names })
      : t("No install for {tools}: you'll learn with examples.", { tools: names });
  };
}
