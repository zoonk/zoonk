import { NotFoundMessage } from "@/components/public/not-found-message";
import { LearnPageBar } from "@zoonk/learn/bar";

/**
 * A goal's onboarding or a course's start that isn't there (an old or mistyped link) says so
 * inside the app's frame, as its other pages do: the sidebar and the tabs stay, and under `lg` the
 * bar's way back to the app page the learner came from.
 */
export function OnboardingNotFound() {
  return (
    <>
      <LearnPageBar back={{ href: "/today" }} root />
      <NotFoundMessage />
    </>
  );
}
