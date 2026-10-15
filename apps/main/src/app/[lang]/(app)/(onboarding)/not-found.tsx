import { OnboardingNotFound } from "./_components/onboarding-not-found";

/** An onboarding page that isn't there, shown by the browser where a page threw `notFound()`. */
export default function NotFound() {
  return <OnboardingNotFound />;
}
