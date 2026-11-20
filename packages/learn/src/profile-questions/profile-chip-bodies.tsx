"use client";

import {
  MAX_PROFILE_FAVORITES_LENGTH,
  MAX_PROFILE_JOB_LENGTH,
  MAX_PROFILE_SUBJECT_LENGTH,
} from "@zoonk/core/profile/questions/contract";
import { PROFILE_FAVORITES_SEPARATOR } from "@zoonk/core/profile/questions/favorites";
import { InputGroupButton } from "@zoonk/ui/components/input-group";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import { useFocusOnRemovedControl } from "../_components/suggestion-focus";
import { ChoiceList } from "../onboarding/choice-list";
import { TextField } from "../onboarding/steps/text-field";
import { type BodyProps, setText, useExclusiveLabels, usePicker } from "./profile-body-parts";
import { ProfileChips, TypedChips } from "./profile-chips";
import {
  type ChipQuestion,
  addTypedTools,
  getTypedToolsRoom,
  toggleProfileExclusive,
  toggleProfilePick,
} from "./profile-draft";

function useFavoritesField(question: ChipQuestion) {
  const t = useExtracted();

  switch (question) {
    case "tools":
      return { label: t("Others (optional)"), placeholder: t("E.g., Photoshop, Python, SAP") };
    case "watch":
      return {
        label: t("Favorite shows, films, teams or channels (optional)"),
        placeholder: t("E.g., Star Trek, Formula 1"),
      };
    case "listen":
      return {
        label: t("Favorite artists or podcasts (optional)"),
        placeholder: t("E.g., Coldplay, TED Talks Daily"),
      };
    case "play":
      return { label: t("Favorite games (optional)"), placeholder: t("E.g., Catan, Valorant") };
    case "read":
      return {
        label: t("Favorite books, writers or sites (optional)"),
        placeholder: t("E.g., Dune, The Economist"),
      };
    case "activities":
      return {
        label: t("Anything else you're into? (optional)"),
        placeholder: t("E.g., baking bread, cars, astronomy"),
      };
    default:
      return question satisfies never;
  }
}

function OfferedChips(props: BodyProps & { label: string }) {
  const { draft, question } = props;
  const picker = usePicker(props);

  return (
    <ProfileChips
      label={props.label}
      onToggle={picker.toggle}
      options={question.options.map((option) => ({
        id: option.id,
        label: option.label,
        pressed: draft.picks.includes(option.id),
      }))}
    />
  );
}

/**
 * Typed tools become chips under the field, so adding one moves nothing above it. Enter adds
 * while there's text, and sends the screen only once the field is empty.
 */
function ToolsBody(props: BodyProps & { label: string }) {
  const t = useExtracted();
  const { draft, onChange, question } = props;
  const field = useFavoritesField("tools");
  const input = useRef<HTMLInputElement>(null);
  const typing = useRef<HTMLDivElement>(null);
  const hasText = draft.text.trim() !== "";

  // A removed chip's control takes focus with it; the field gets it back.
  useFocusOnRemovedControl(typing, () => input.current);

  const add = (text: string) =>
    onChange(addTypedTools({ draft: { ...draft, text }, options: question.options }));

  return (
    <>
      <OfferedChips {...props} />

      <div className="flex flex-col gap-3" ref={typing}>
        <TextField
          action={
            <InputGroupButton
              disabled={!hasText}
              onClick={() => {
                add(draft.text);
                input.current?.focus();
              }}
              size="sm"
            >
              {t({
                description: "Adds the tool typed in the field to the learner's list.",
                message: "Add",
              })}
            </InputGroupButton>
          }
          autoFocus={false}
          inputRef={input}
          label={field.label}
          maxLength={getTypedToolsRoom(draft.typed)}
          onChange={(text) =>
            PROFILE_FAVORITES_SEPARATOR.test(text) ? add(text) : setText(props, text)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && hasText) {
              event.preventDefault();
              add(draft.text);
            }
          }}
          placeholder={field.placeholder}
          value={draft.text}
        />

        {draft.typed.length > 0 && (
          <TypedChips
            items={draft.typed}
            onRemove={(tool) =>
              onChange({ ...draft, typed: draft.typed.filter((item) => item !== tool) })
            }
          />
        )}
      </div>
    </>
  );
}

export function ChipBody(props: BodyProps & { chip: ChipQuestion; label: string }) {
  const { draft } = props;
  const field = useFavoritesField(props.chip);

  if (props.chip === "tools") {
    return <ToolsBody {...props} />;
  }

  return (
    <>
      <OfferedChips {...props} />

      <TextField
        autoFocus={false}
        label={field.label}
        maxLength={MAX_PROFILE_FAVORITES_LENGTH}
        onChange={(text) => setText(props, text)}
        placeholder={field.placeholder}
        value={draft.text}
      />
    </>
  );
}

export function WorkBody(
  props: BodyProps & { declineAsSkip: boolean; jobPrefill: string | null; label: string },
) {
  const t = useExtracted();
  const { draft, jobPrefill, question } = props;
  const exclusiveLabels = useExclusiveLabels();
  const status = draft.exclusive ?? draft.picks[0] ?? null;

  const jobField = (
    <TextField
      autoFocus={false}
      description={
        jobPrefill && draft.text === jobPrefill ? t("From your earlier answer") : undefined
      }
      label={t("Your job (optional)")}
      maxLength={MAX_PROFILE_JOB_LENGTH}
      onChange={(text) => setText(props, text)}
      placeholder={t("E.g., software engineer, nurse")}
      value={draft.text}
    />
  );

  return (
    <ChoiceList
      choices={[
        ...question.options.map((option) => ({
          after:
            status === option.id && (option.id === "work" || option.id === "workAndStudy")
              ? jobField
              : undefined,
          label: option.label,
          value: option.id,
        })),
        ...(props.declineAsSkip ? [] : [{ label: exclusiveLabels.ratherNot, value: "ratherNot" }]),
      ]}
      label={props.label}
      onChange={(value) =>
        props.onChange(
          value === "ratherNot"
            ? toggleProfileExclusive({ draft, exclusive: value })
            : toggleProfilePick({ draft, id: value, question: question.id }),
        )
      }
      value={status}
    />
  );
}

export function AddressFormBody(props: BodyProps & { declineAsSkip: boolean; label: string }) {
  const { draft, question } = props;
  const exclusiveLabels = useExclusiveLabels();

  return (
    <ChoiceList
      choices={[
        ...question.options.map((option) => ({
          description: option.description ?? undefined,
          label: option.label,
          value: option.id,
        })),
        ...(props.declineAsSkip
          ? []
          : [{ label: exclusiveLabels.ratherNot, value: "ratherNot" as const }]),
      ]}
      label={props.label}
      onChange={(value) =>
        props.onChange(
          value === "ratherNot"
            ? toggleProfileExclusive({ draft, exclusive: value })
            : toggleProfilePick({ draft, id: value, question: question.id }),
        )
      }
      value={draft.exclusive ?? draft.picks[0] ?? null}
    />
  );
}

export function StudiesBody(props: BodyProps & { label: string }) {
  const t = useExtracted();
  const { draft, question } = props;
  const picker = usePicker(props);
  const labelOf = (id: string) => question.options.find((option) => option.id === id)?.label ?? id;

  const setSubject = (field: string, subject: string) =>
    props.onChange({
      ...draft,
      studies: draft.studies.map((study) =>
        study.field === field ? { ...study, subject } : study,
      ),
    });

  return (
    <>
      <ProfileChips
        label={props.label}
        onToggle={picker.toggle}
        options={question.options.map((option) => ({
          id: option.id,
          label: option.label,
          pressed: draft.studies.some((study) => study.field === option.id),
        }))}
      />

      {draft.studies.map((study) => (
        <TextField
          autoFocus={false}
          key={study.field}
          label={
            study.field === "other"
              ? t("Which field?")
              : t("{field}: course or subject (optional)", { field: labelOf(study.field) })
          }
          maxLength={MAX_PROFILE_SUBJECT_LENGTH}
          onChange={(subject) => setSubject(study.field, subject)}
          placeholder={t("E.g., journalism")}
          required={study.field === "other"}
          value={study.subject}
        />
      ))}
    </>
  );
}
