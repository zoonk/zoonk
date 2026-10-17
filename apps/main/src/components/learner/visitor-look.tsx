/**
 * A visitor's look in the frame while the learner summary is unread, hidden on a page the session
 * hint marked signed in (`signed-in:`, from `SignedInHintScript`): a learner sees their quiet
 * account place there instead of a visitor's way in. Once read, a visitor's look stands on its
 * own and a learner's replaces it.
 */
export function VisitorLook({ children }: { children: React.ReactNode }) {
  return <div className="signed-in:hidden contents">{children}</div>;
}
