const documentActivation = { seen: false, tracking: false, waiting: Promise.withResolvers<null>() };

/** Called before hydration so browsers without UserActivation retain an in-app tap too. */
export function trackUserActivation(): void {
  if (documentActivation.tracking || documentActivation.seen) {
    return;
  }

  documentActivation.tracking = true;

  const activated = () => {
    documentActivation.seen = true;
    documentActivation.waiting.resolve(null);
    globalThis.removeEventListener("pointerdown", activated, true);
    globalThis.removeEventListener("keydown", activated, true);
  };

  globalThis.addEventListener("pointerdown", activated, { capture: true, once: true });
  globalThis.addEventListener("keydown", activated, { capture: true, once: true });
}

/** A study URL must not owe preparation merely because a document loaded; every automatic start waits here too. */
export async function waitForUserActivation(): Promise<void> {
  if (documentActivation.seen || navigator.userActivation?.hasBeenActive) {
    return;
  }

  trackUserActivation();
  await documentActivation.waiting.promise;
}
