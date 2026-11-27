const documentActivation = { seen: false, tracking: false, waiting: Promise.withResolvers<null>() };
const ACTIVATION_EVENTS = ["click", "keydown", "pointerup", "touchend"] as const;

/** Called before hydration so browsers without UserActivation retain an in-app tap too. */
export function trackUserActivation(): void {
  if (documentActivation.tracking || documentActivation.seen) {
    return;
  }

  documentActivation.tracking = true;

  const activated = () => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      return;
    }

    documentActivation.seen = true;
    documentActivation.waiting.resolve(null);

    for (const event of ACTIVATION_EVENTS) {
      globalThis.removeEventListener(event, activated, true);
    }
  };

  for (const event of ACTIVATION_EVENTS) {
    globalThis.addEventListener(event, activated, true);
  }
}

function hasUserActivation(): boolean {
  return globalThis.navigator?.userActivation?.hasBeenActive ?? documentActivation.seen;
}

let studyNavigation: string | null = null;

/** A fresh document and a history traversal have no study navigation to consume. */
export function noteStudyNavigation(
  url: string,
  navigation: "push" | "replace" | "traverse",
): void {
  studyNavigation =
    navigation === "push" && hasUserActivation() ? new URL(url, location.href).href : null;
}

export function takeStudyNavigation(): boolean {
  const tapped = studyNavigation === location.href;
  studyNavigation = null;
  return tapped;
}

/** A study URL must not owe preparation merely because a document loaded; every automatic start waits here too. */
export async function waitForUserActivation(): Promise<void> {
  if (hasUserActivation()) {
    return;
  }

  trackUserActivation();
  await documentActivation.waiting.promise;
}
