export type SessionUser = { isAnonymous?: boolean | null };

/**
 * Whether a response should set the account marker, clear it, or leave it. A new session sets it
 * for an account and clears it for a guest; an ended session clears it; a browser checking its
 * session repairs a marker that's missing or left over (sessions from before the marker, or one
 * that expired on its own).
 */
export function getAccountMarkerChange({
  checkedUser,
  endsSession,
  hasMarker,
  newUser,
}: {
  /** Who a browser's session check found; undefined when the response isn't one. */
  checkedUser?: SessionUser | null;
  endsSession: boolean;
  hasMarker: boolean;
  /** The user of the session this response starts, if it starts one. */
  newUser: SessionUser | null;
}): "clear" | "set" | null {
  if (endsSession) {
    return hasMarker ? "clear" : null;
  }

  if (newUser) {
    if (!newUser.isAnonymous) {
      return "set";
    }

    return hasMarker ? "clear" : null;
  }

  if (checkedUser === undefined) {
    return null;
  }

  const isAccount = Boolean(checkedUser && !checkedUser.isAnonymous);

  if (isAccount === hasMarker) {
    return null;
  }

  return isAccount ? "set" : "clear";
}
