import { IDENTITY_COVER_ID } from "./identity-cover-boot";
import { checkIdentity } from "./learner-identity";

/** Whether an event's target is the cover's plane or one of its controls. */
function isOnCover(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`#${IDENTITY_COVER_ID}`) !== null;
}

/**
 * A press, a key, a click or a form sent on a page that no longer belongs to the learner the
 * browser holds never reaches the page: the check decides the departure (the page is covered and
 * reloads), and the event stops here, before any handler starts a navigation or a write. The
 * cover's own controls (Try again, Reload) always work: the check is what put them there.
 */
export function stopInputOnDeparture(event: Event): void {
  if (isOnCover(event.target)) {
    return;
  }

  if (!checkIdentity()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
