import { type TutorIdentity } from "@zoonk/learn/tutor-identity";

export function AskTutorFace({ identity }: { identity: TutorIdentity }) {
  return (
    <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
      {identity.avatar}
    </span>
  );
}
