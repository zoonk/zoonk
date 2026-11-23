"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ANSWER_OPTION_CLASS,
  ANSWER_TAG_CLASS,
  ANSWER_TAG_TONE,
  ANSWER_TONE,
} from "../../_components/answer-tone";
import { SortableList } from "../../_components/sortable-list";
import { ItemLine } from "../../questions/item-text";

export type OrderResult = { correctOrder: readonly number[]; order: readonly number[] | null };

function placeMark(result: OrderResult | null, place: number) {
  if (!result?.order || result.correctOrder.length === 0) {
    return null;
  }

  return result.correctOrder[place] === result.order[place] ? "right" : "wrong";
}

export function OrderQuestion({
  disabled,
  onChange,
  order,
  result,
  steps,
}: {
  disabled: boolean;
  onChange: (answer: { order: number[] }) => void;
  order?: readonly number[];
  result: OrderResult | null;
  steps: readonly string[];
}) {
  const t = useExtracted();

  const displayed = result?.order ?? order ?? steps.map((_, index) => index);

  if (disabled || result) {
    return (
      <ol className="flex flex-col gap-2">
        {displayed.map((index, place) => {
          const mark = placeMark(result, place);

          return (
            <li className={cn(ANSWER_OPTION_CLASS, ANSWER_TONE[mark ?? "idle"])} key={index}>
              <span className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
                {place + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <ItemLine text={steps[index] ?? ""} />
                {mark && (
                  <span className={cn(ANSWER_TAG_CLASS, ANSWER_TAG_TONE[mark])}>
                    {mark === "right" ? t("Right place") : t("Wrong place")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm font-medium">{t("Drag the steps into order.")}</p>
      <SortableList
        items={displayed.map((index) => ({ id: String(index), label: steps[index] ?? "" }))}
        label={t("Steps, in your order")}
        onReorder={(ids) => onChange({ order: ids.map(Number) })}
        renderItem={(item) => (
          <span className="text-reading min-w-0 flex-1 py-1 font-medium wrap-break-word">
            <ItemLine text={item.label} />
          </span>
        )}
      />
    </div>
  );
}
