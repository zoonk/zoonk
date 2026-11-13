"use client";

import { type BodyProps } from "./profile-body-parts";
import { AddressFormBody, ChipBody, StudiesBody, WorkBody } from "./profile-chip-bodies";
import { ConditionsBody, SupportBody } from "./profile-row-bodies";

export function ProfileQuestionBody({
  declineAsSkip = false,
  jobPrefill = null,
  label,
  prechecked = false,
  ...props
}: BodyProps & {
  /** Onboarding declines through its Skip button, so no body draws a row that declines. */
  declineAsSkip?: boolean;
  /** The goal's current role, prefilled into the job field. */
  jobPrefill?: string | null;
  /** Names the answer area for screen readers: the screen's title. */
  label: string;
  prechecked?: boolean;
}) {
  switch (props.question.id) {
    case "work":
      return (
        <WorkBody {...props} declineAsSkip={declineAsSkip} jobPrefill={jobPrefill} label={label} />
      );
    case "studies":
      return <StudiesBody {...props} label={label} />;
    case "conditions":
      return <ConditionsBody {...props} label={label} />;
    case "learningSupport":
      return <SupportBody {...props} label={label} prechecked={prechecked} />;
    case "addressForm":
      return <AddressFormBody {...props} declineAsSkip={declineAsSkip} label={label} />;
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
