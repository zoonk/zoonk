"use client";

import {
  MAX_PROFILE_FAVORITES_LENGTH,
  MAX_PROFILE_JOB_LENGTH,
  MAX_PROFILE_SUBJECT_LENGTH,
} from "@zoonk/core/profile/questions/contract";
import { useExtracted } from "next-intl";
import { ChoiceList } from "../onboarding/choice-list";
import { TextField } from "../onboarding/steps/text-field";
import { type BodyProps, setText, useExclusiveLabels, usePicker } from "./profile-body-parts";
import { ProfileChip, ProfileChips } from "./profile-chips";
import { type ChipQuestion, toggleProfileExclusive, toggleProfilePick } from "./profile-draft";

function useFavoritesField(question: ChipQuestion) {
  const t = useExtracted();

  switch (question) {
    case "tools":
      return { label: t("Others (optional)"), placeholder: t("E.g., Photoshop, Python, SAP") };
    case "watch":
      return {
        label: t("Favorite shows, films, teams or channels (optional)"),
        placeholder: t("E.g., Star Trek, Flamengo"),
      };
    case "listen":
      return {
        label: t("Favorite artists or podcasts (optional)"),
        placeholder: t("E.g., Coldplay, Radiolab"),
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

export function ChipBody(props: BodyProps & { chip: ChipQuestion; label: string }) {
  const { draft, question } = props;
  const picker = usePicker(props);
  const field = useFavoritesField(props.chip);
  const exclusiveLabels = useExclusiveLabels();

  return (
    <>
      <ProfileChips
        capped={picker.capped}
        label={props.label}
        onToggle={picker.toggle}
        options={question.options.map((option) => ({
          id: option.id,
          label: option.label,
          pressed: draft.picks.includes(option.id),
        }))}
      />

      <TextField
        autoFocus={false}
        label={field.label}
        maxLength={MAX_PROFILE_FAVORITES_LENGTH}
        onChange={(text) => setText(props, text)}
        placeholder={field.placeholder}
        value={draft.text}
      />

      <div className="flex">
        <ProfileChip
          label={exclusiveLabels.none}
          onToggle={() => picker.exclusive("none")}
          pressed={draft.exclusive === "none"}
        />
      </div>
    </>
  );
}

export function WorkBody(props: BodyProps & { jobPrefill: string | null; label: string }) {
  const t = useExtracted();
  const { draft, jobPrefill, question } = props;
  const exclusiveLabels = useExclusiveLabels();
  const status = draft.exclusive ?? draft.picks[0] ?? null;

  const jobField = (
    <div className="pb-3 pl-1">
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
    </div>
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
        { label: exclusiveLabels.ratherNot, value: "ratherNot" },
      ]}
      label={props.label}
      numberKeys={false}
      onChange={(value) =>
        props.onChange(
          value === "ratherNot"
            ? toggleProfileExclusive({ draft, exclusive: value })
            : toggleProfilePick({ draft, id: value, question: question.id }).draft,
        )
      }
      value={status}
    />
  );
}

export function StudiesBody(props: BodyProps & { label: string }) {
  const t = useExtracted();
  const { draft, question } = props;
  const picker = usePicker(props);
  const exclusiveLabels = useExclusiveLabels();
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
        capped={picker.capped}
        label={props.label}
        onToggle={picker.toggle}
        options={question.options.map((option) => ({
          id: option.id,
          label: option.label,
          pressed: draft.studies.some((study) => study.field === option.id),
        }))}
      />

      <div className="flex">
        <ProfileChip
          label={exclusiveLabels.nothing}
          onToggle={() => picker.exclusive("nothing")}
          pressed={draft.exclusive === "nothing"}
        />
      </div>

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
