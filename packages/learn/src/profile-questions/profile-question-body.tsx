"use client";

import { type BodyProps } from "./profile-body-parts";
import { ChipBody, StudiesBody, WorkBody } from "./profile-chip-bodies";
import { ConditionsBody, SupportBody } from "./profile-row-bodies";

export function ProfileQuestionBody({
  jobPrefill = null,
  label,
  prechecked = false,
  ...props
}: BodyProps & {
  /** The goal's current role, prefilled into the job field. */
  jobPrefill?: string | null;
  /** Names the answer area for screen readers: the screen's title. */
  label: string;
  prechecked?: boolean;
}) {
  switch (props.question.id) {
    case "work":
      return <WorkBody {...props} jobPrefill={jobPrefill} label={label} />;
    case "studies":
      return <StudiesBody {...props} label={label} />;
    case "conditions":
      return <ConditionsBody {...props} label={label} />;
    case "learningSupport":
      return <SupportBody {...props} label={label} prechecked={prechecked} />;
    case "tools":
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return <ChipBody {...props} chip={props.question.id} label={label} />;
    default:
      return props.question.id satisfies never;
  }
}
