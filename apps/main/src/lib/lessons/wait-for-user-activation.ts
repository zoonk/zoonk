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

/** A study URL must not owe preparation merely because a document loaded; every automatic start waits here too. */
export async function waitForUserActivation(): Promise<void> {
  if (navigator.userActivation ? navigator.userActivation.hasBeenActive : documentActivation.seen) {
    return;
  }

  trackUserActivation();
  await documentActivation.waiting.promise;
}
