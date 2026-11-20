"use client";

import { type Packet } from "@/lib/comparisons/schemas";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import { Label } from "@zoonk/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { Textarea } from "@zoonk/ui/components/textarea";
import { cn } from "@zoonk/ui/lib/utils";
import { PlusIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { CaseInput } from "../../../_components/case-input";
import { ReadableOutput } from "../../../_components/readable-output";
import { failureAdvice } from "../../../_utils/words";
import { type BlindReadResult, saveBlindReadAction } from "./actions";

type Pair = Packet["pairs"][number];
type Criterion = Packet["criteria"][number];

const PAIR_CHOICES = [
  { label: "A", value: "A" },
  { label: "Tie", value: "tie" },
  { label: "B", value: "B" },
];

const OUTPUT_CHOICES = [
  { label: "A", value: "A" },
  { label: "B", value: "B" },
];

const SEVERITY_CHOICES = [
  { label: "Major: would mislead or lose the learner", value: "major" },
  { label: "Minor", value: "minor" },
];

function Choice({
  choices,
  className,
  label,
  name,
}: {
  choices: { label: string; value: string }[];
  className?: string;
  label: string;
  name: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      className={cn("flex flex-wrap gap-x-6 gap-y-3", className)}
      name={name}
      required
    >
      {choices.map((choice) => (
        <RadioGroupOption className="min-h-6 font-normal" key={choice.value}>
          <RadioGroupItem value={choice.value} />
          {choice.label}
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}

function TextField({
  label,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        className="min-h-11"
        id={id}
        name={name}
        placeholder={placeholder}
        required={required}
        rows={1}
      />
    </div>
  );
}

function ProblemFields({
  audit,
  criteria,
  onRemove,
  prefix,
}: {
  audit: boolean;
  criteria: Criterion[];
  onRemove: () => void;
  prefix: string;
}) {
  const criterionId = useId();

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      {!audit && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">In which answer</p>
          <Choice choices={OUTPUT_CHOICES} label="In which answer" name={`${prefix}:output`} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={criterionId}>About</Label>
        <NativeSelect
          className="w-full"
          defaultValue=""
          id={criterionId}
          name={`${prefix}:criterion`}
          required
        >
          <NativeSelectOption disabled value="">
            Choose what it’s about
          </NativeSelectOption>
          {criteria.map((criterion) => (
            <NativeSelectOption key={criterion.id} value={criterion.id}>
              {criterion.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">How bad</p>
        <Choice choices={SEVERITY_CHOICES} label="How bad" name={`${prefix}:severity`} />
      </div>

      <TextField label="What’s wrong" name={`${prefix}:claim`} required />
      <TextField label="What it costs the learner" name={`${prefix}:cost`} required />
      <TextField
        label="Where"
        name={`${prefix}:where`}
        placeholder="The exact words, or the part, such as screens 3–5. Leave empty for the whole answer."
      />

      <Button className="self-start" edge="start" onClick={onRemove} type="button" variant="ghost">
        Remove
      </Button>
    </div>
  );
}

function Problems({
  audit,
  criteria,
  pair,
}: {
  audit: boolean;
  criteria: Criterion[];
  pair: Pair;
}) {
  const [keys, setKeys] = useState<number[]>([]);

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Problems</p>
        <p className="text-muted-foreground text-sm">
          {audit
            ? "List what’s wrong with this answer, if anything."
            : "Add each mistake or anything that would lose the learner, if you see one."}
        </p>
      </div>

      {keys.map((key) => (
        <ProblemFields
          audit={audit}
          criteria={criteria}
          key={key}
          onRemove={() => setKeys((current) => current.filter((entry) => entry !== key))}
          prefix={`${pair.pairId}:problem-${key}`}
        />
      ))}

      <Button
        className="self-start"
        icon={<PlusIcon />}
        onClick={() => setKeys((current) => [...current, Math.max(0, ...current) + 1])}
        type="button"
        variant="outline"
      >
        Add a problem
      </Button>
    </div>
  );
}

function Preferences({ criteria, pair }: { criteria: Criterion[]; pair: Pair }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-medium">Which serves the learner better?</p>
        <Choice
          choices={PAIR_CHOICES}
          label="Which serves the learner better"
          name={`${pair.pairId}:overall`}
        />
        <TextField label="Why" name={`${pair.pairId}:overall-reason`} required />
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-medium">On each point</p>
        <ul className="flex flex-col">
          {criteria.map((criterion) => (
            <li
              className="flex flex-col gap-2 border-t py-3 first:border-t-0 sm:grid sm:grid-cols-[14rem_auto] sm:items-center sm:gap-6"
              key={criterion.id}
            >
              <span className="text-sm">{criterion.label}</span>
              <Choice
                choices={PAIR_CHOICES}
                className="w-auto"
                label={criterion.label}
                name={`${pair.pairId}:criterion-${criterion.id}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="rounded-xl border p-4">
        <ReadableOutput text={text} />
      </div>
    </div>
  );
}

function PairRead({
  criteria,
  index,
  pair,
  total,
}: {
  criteria: Criterion[];
  index: number;
  pair: Pair;
  total: number;
}) {
  const audit = pair.B === null;

  return (
    <section className="flex flex-col gap-6 border-t pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight">
        Pair {index + 1} of {total}
      </h2>

      <CaseInput expectations={pair.expectations} input={pair.input} />

      <div className={cn("grid gap-6", !audit && "lg:grid-cols-2")}>
        <Answer label={audit ? "The answer" : "A"} text={pair.A} />
        {pair.B !== null && <Answer label="B" text={pair.B} />}
      </div>

      {!audit && <Preferences criteria={criteria} pair={pair} />}
      <Problems audit={audit} criteria={criteria} pair={pair} />
    </section>
  );
}

function resultNote(result: BlindReadResult | null) {
  if (!result) {
    return null;
  }

  if ("error" in result) {
    return (
      <p role="alert" className="text-destructive-text">
        {result.error}
      </p>
    );
  }

  if (!result.passed) {
    return (
      <p role="alert" className="text-destructive-text">
        This read didn’t count:{" "}
        {result.failures.map((failure) => failureAdvice(failure)).join("; ")}. Change it and submit
        again.
      </p>
    );
  }

  return null;
}

/**
 * The owner's blind read of one packet: only the anonymous pairs reach the browser, never which
 * model wrote A or B. The engine grades the hidden checks when the read is saved.
 */
export function BlindReadForm({
  comparisonId,
  packet,
  packetId,
  taskId,
}: {
  comparisonId: string;
  packet: Packet;
  packetId: string;
  taskId: string;
}) {
  const [result, setResult] = useState<BlindReadResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        startTransition(async () => {
          const saved = await saveBlindReadAction(data).catch(() => ({
            error: "The server couldn’t be reached. Try again.",
          }));

          setResult(saved);
        });
      }}
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="comparisonId" type="hidden" value={comparisonId} />
      <input name="packetId" type="hidden" value={packetId} />

      <div className="flex flex-1 flex-col gap-12">
        {packet.pairs.map((pair, index) => (
          <PairRead
            criteria={packet.criteria}
            index={index}
            key={pair.pairId}
            pair={pair}
            total={packet.pairs.length}
          />
        ))}
      </div>

      <BottomBar note={resultNote(result)}>
        <BottomBarActions>
          <EnterButton busy={pending} enter="off" type="submit">
            Submit
          </EnterButton>
        </BottomBarActions>
      </BottomBar>
    </form>
  );
}
