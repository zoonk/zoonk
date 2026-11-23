"use client";

import { useExtracted } from "next-intl";
import { AnswerOption, AnswerOptionGroup } from "../../_components/answer-option";
import { SortableList } from "../../_components/sortable-list";
import { ItemLine } from "../../questions/item-text";

export type OrderResult = { correctOrder: readonly number[]; order: readonly number[] };

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

  if (result) {
    return (
      <AnswerOptionGroup role="group">
        {result.order.map((index, place) => {
          const right = result.correctOrder[place] === index;

          return (
            <AnswerOption
              disabled
              key={index}
              marker={place + 1}
              picked
              result={right ? "right" : "wrong"}
              tag={right ? t("Right place") : t("Wrong place")}
            >
              <ItemLine text={steps[index] ?? ""} />
            </AnswerOption>
          );
        })}
      </AnswerOptionGroup>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm font-medium">{t("Drag the steps into order.")}</p>
      <SortableList
        disabled={disabled}
        items={(order ?? steps.map((_, index) => index)).map((index) => ({
          id: String(index),
          label: steps[index] ?? "",
        }))}
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
