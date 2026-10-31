import { NotFoundMessage } from "@/components/public/not-found-message";
import { LearnPageBar } from "@zoonk/learn/bar";

export function OnboardingNotFound() {
  return (
    <>
      <LearnPageBar back={{ href: "/today" }} root />
      <NotFoundMessage />
    </>
  );
}
