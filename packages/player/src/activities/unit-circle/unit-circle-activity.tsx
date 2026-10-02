"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { angleStep, fromDegrees, snapAngle, toDegrees } from "./unit-circle-angle";
import { UnitCircleDial } from "./unit-circle-dial";
import { UnitCircleWave, isWave } from "./unit-circle-wave";
import {
  type TrigName,
  useFormatAngle,
  useFormatTrig,
  useTrigNames,
} from "./use-unit-circle-format";

type UnitCircleProps = ActivityRendererProps<"unitCircle">;
type Content = UnitCircleProps["content"];

/** The angle a numeric check asks about, in degrees, and the value it reads there. */
function checkTarget(content: Content): { degrees: number; output: TrigName } | null {
  const { check, fields } = content;

  if (check.kind !== "numeric") {
    return null;
  }

  const angle = check.inputs?.find((input) => input.name === "angle")?.value ?? fields.startAngle;
  const output = fields.show.find((name) => name === check.output) ?? fields.show[0];

  return output ? { degrees: toDegrees(angle, fields.angleUnit), output } : null;
}

function valueAt(content: Content, degrees: number, output: TrigName): number | null {
  return computeActivityValue(content, {
    inputs: { angle: fromDegrees(degrees, content.fields.angleUnit) },
    output,
  });
}

/**
 * Turn a point around a circle of radius 1: its height is the sine, its sideways distance the
 * cosine, and the waves they trace draw themselves as it turns. Values come from core's template
 * hook, the same one grading uses. With a numeric check, the value the check reads at the point's
 * angle is the learner's answer.
 */
export function UnitCircleActivity({
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: UnitCircleProps) {
  const t = useExtracted();
  const names = useTrigNames();
  const formatTrig = useFormatTrig();
  const { fields } = content;
  const formatAngle = useFormatAngle(fields.angleUnit);
  const target = checkTarget(content);
  const startDegrees = toDegrees(fields.startAngle, fields.angleUnit);
  const step = angleStep(target ? [startDegrees, target.degrees] : [startDegrees]);
  const [degrees, setDegrees] = useState(() => snapAngle(startDegrees, step));
  const isChecked = phase === "checked";

  /* Core returns null for a value the lesson doesn't show, so only shown ones are drawn. */
  const values: Record<TrigName, number | null> = {
    cos: valueAt(content, degrees, "cos"),
    sin: valueAt(content, degrees, "sin"),
    tan: valueAt(content, degrees, "tan"),
  };

  const valueList = fields.show
    .map((name) => `${names[name]} = ${formatTrig(values[name])}`)
    .join(", ");

  function handleChange(next: number) {
    setDegrees(next);

    if (target) {
      const value = valueAt(content, next, target.output);
      onAnswerChange(value === null ? null : { kind: "numeric", value });
    }
  }

  /* Only the angle sits by the marked point; the value is in the feedback and said below. */
  const expectedMark =
    isChecked && target && expected?.kind === "numeric"
      ? { degrees: target.degrees, label: formatAngle(target.degrees), value: expected.value }
      : null;

  const waves = fields.show.filter((name) => isWave(name));

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityCanvasLabel className="text-sm">
        <LessonRichText text={fields.frame} />
      </ActivityCanvasLabel>

      <UnitCircleDial
        angleLabel={formatAngle(degrees)}
        degrees={degrees}
        disabled={isChecked}
        formatValue={formatTrig}
        label={t("Point on the circle")}
        onChange={handleChange}
        show={fields.show}
        step={step}
        target={expectedMark}
        values={values}
        valueText={t("{angle}. {values}", { angle: formatAngle(degrees), values: valueList })}
      />

      {waves.length > 0 && (
        <UnitCircleWave degrees={degrees} formatAngle={formatAngle} show={waves} />
      )}

      <ActivityTextAlternative>
        {t(
          "A circle of radius 1 with a point at {angle}. Its height is the sine and its sideways distance from the center is the cosine: {values}.",
          { angle: formatAngle(degrees), values: valueList },
        )}{" "}
        {expectedMark &&
          target &&
          t("The question asks about {angle}, where {name} = {value}.", {
            angle: expectedMark.label,
            name: names[target.output],
            value: formatTrig(expectedMark.value),
          })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
