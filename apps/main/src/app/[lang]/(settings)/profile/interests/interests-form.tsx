"use client";

import { Link } from "@/i18n/navigation";
import { runClientAction } from "@/lib/client-action";
import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@zoonk/ui/components/field";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import {
  AtomIcon,
  CameraIcon,
  ChefHatIcon,
  CpuIcon,
  MusicIcon,
  RocketIcon,
  ShirtIcon,
  TrophyIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { saveInterests } from "./actions";

export function InterestsForm({ interests }: { interests: string[] }) {
  const t = useExtracted();

  const suggestions = [
    { icon: CpuIcon, label: t("Technology"), value: "Technology" },
    { icon: TrophyIcon, label: t("Sports"), value: "Sports" },
    { icon: AtomIcon, label: t("Science"), value: "Science" },
    { icon: ShirtIcon, label: t("Fashion"), value: "Fashion" },
    { icon: RocketIcon, label: t("Science fiction"), value: "Science fiction" },
    { icon: CameraIcon, label: t("Photography"), value: "Photography" },
    { icon: MusicIcon, label: t("Music"), value: "Music" },
    { icon: ChefHatIcon, label: t("Cooking"), value: "Cooking" },
  ];

  function isSuggestedInterest(value: string) {
    return suggestions.some((interest) => interest.value.toLowerCase() === value.toLowerCase());
  }

  const inputId = useId();
  const hintId = useId();

  const [selected, setSelected] = useState(
    interests.filter((interest) => isSuggestedInterest(interest)),
  );

  const [value, setValue] = useState(
    interests.filter((interest) => !isSuggestedInterest(interest)).join("\n"),
  );

  const [status, setStatus] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-md flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus(undefined);

        startTransition(async () => {
          const result = await runClientAction(
            () => saveInterests([...selected, value].join("\n")),
            { status: "unavailable" as const },
          );

          setStatus(result.status);
        });
      }}
    >
      <fieldset aria-describedby={hintId} className="flex flex-col gap-3" disabled={pending}>
        <legend className="mb-2 text-sm font-medium">{t("What do you enjoy?")}</legend>
        <p className="text-muted-foreground text-sm" id={hintId}>
          {t(
            "Choose any interests you like. These help us use familiar examples in your personal courses. You can leave this blank or change it anytime.",
          )}
        </p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1">
          {suggestions.map(({ icon: Icon, label, value: interest }) => {
            const id = `${inputId}-${interest.replaceAll(" ", "-")}`;
            const checked = selected.some((item) => item.toLowerCase() === interest.toLowerCase());

            return (
              <Field className="min-h-12" key={interest} orientation="horizontal">
                <FieldLabel
                  className="min-h-12 flex-1 cursor-pointer gap-2 font-normal"
                  htmlFor={id}
                >
                  <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                  {label}
                </FieldLabel>
                <Checkbox
                  checked={checked}
                  disabled={pending}
                  id={id}
                  onCheckedChange={(next) => {
                    setSelected(
                      next
                        ? [...selected, interest]
                        : selected.filter((item) => item.toLowerCase() !== interest.toLowerCase()),
                    );

                    setStatus(undefined);
                  }}
                />
              </Field>
            );
          })}
        </div>
      </fieldset>
      <Field>
        <FieldLabel htmlFor={inputId}>{t("Other interests")}</FieldLabel>
        <Textarea
          disabled={pending}
          id={inputId}
          maxLength={6049}
          onChange={(event) => {
            setValue(event.target.value);
            setStatus(undefined);
          }}
          placeholder={t("Gardening\nBoard games")}
          rows={3}
          value={value}
        />
        <FieldDescription>{t("Add one interest per line.")}</FieldDescription>
        {status && status !== "ready" && status !== "unauthorized" && (
          <FieldError>
            {status === "invalid"
              ? t("Use up to 50 interests, with 120 characters or fewer each.")
              : t("We couldn't save your interests. Please try again.")}
          </FieldError>
        )}
      </Field>
      {status === "unauthorized" && (
        <Link
          className="text-sm underline underline-offset-4"
          href="/login?next=%2Fprofile%2Finterests"
        >
          {t("Sign in again to save your interests")}
        </Link>
      )}
      {status === "ready" && (
        <p className="text-sm" role="status">
          {t("Your interests are saved.")}
        </p>
      )}
      <Button aria-busy={pending} className="min-h-11 w-fit" disabled={pending} type="submit">
        {pending && <Spinner aria-hidden="true" />}
        {t("Save changes")}
      </Button>
    </form>
  );
}
