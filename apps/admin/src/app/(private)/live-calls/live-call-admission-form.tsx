"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { Field, FieldDescription, FieldLabel } from "@zoonk/ui/components/field";
import { Input } from "@zoonk/ui/components/input";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { cn } from "@zoonk/ui/lib/utils";
import { SaveIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type LiveCallAdmissionState,
  updateLiveCallAdmissionAction,
} from "./_actions/live-call-actions";

const INITIAL_STATE: LiveCallAdmissionState = { error: null, message: null, submissionId: 0 };
const MICROS_PER_DOLLAR = 1_000_000;

const ADMISSIONS = [
  { description: "No new calls. Open calls keep running.", label: "Off", value: "off" },
  { description: "Admins only, to try calls before learners.", label: "Staff", value: "staff" },
  {
    description: "Every learner, within their plan’s call limits.",
    label: "Everyone",
    value: "all",
  },
] as const;

type Admission = (typeof ADMISSIONS)[number]["value"];

const OPTION_CLASS =
  "border-border has-data-checked:border-foreground flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm";

/**
 * The switch and the free accounts' shared daily budget in one form: both are read fresh when a
 * call is reserved, so saving applies to the next call without a deploy.
 */
export function LiveCallAdmissionForm({
  admission,
  freeDailyBudgetMicros,
}: {
  admission: Admission;
  freeDailyBudgetMicros: number;
}) {
  const [state, formAction] = useActionState(updateLiveCallAdmissionAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col">
        <legend className="mb-2 text-sm font-medium">Who can start new calls</legend>

        <RadioGroup className="grid gap-2 sm:grid-cols-3" defaultValue={admission} name="admission">
          {ADMISSIONS.map((option) => (
            <RadioGroupOption className={OPTION_CLASS} key={option.value}>
              <RadioGroupItem className="mt-0.5" value={option.value} />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {option.description}
                </span>
              </span>
            </RadioGroupOption>
          ))}
        </RadioGroup>
      </fieldset>

      <Field>
        <FieldLabel htmlFor="free-daily-budget">Free accounts’ daily budget (USD)</FieldLabel>
        <Input
          className="max-w-40 tabular-nums"
          defaultValue={freeDailyBudgetMicros / MICROS_PER_DOLLAR}
          id="free-daily-budget"
          inputMode="decimal"
          min={0}
          name="freeDailyBudget"
          step={0.01}
          type="number"
        />
        <FieldDescription>
          Every free account draws from it, per UTC day. $0 stops free calls.
        </FieldDescription>
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <AdminActionSubmitButton icon={<SaveIcon />}>Save</AdminActionSubmitButton>

        <span
          aria-live="polite"
          className={cn(
            "text-xs empty:hidden",
            state.error ? "text-destructive-text" : "text-muted-foreground",
          )}
          key={state.submissionId}
        >
          {state.error ?? state.message}
        </span>
      </div>
    </form>
  );
}
