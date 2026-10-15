/**
 * The identity cover's port: the cover/bootstrap module (its opaque plane, the reset guard,
 * Reload) as the learner store drives it. The store decides who the page may show; the module
 * draws the cover and reloads the document, and never decides. It registers itself once, with
 * what its parse-time bootstrap found (`registerIdentityCover`).
 *
 * A tag is the session hint's opaque value for one learner (never their id); null is nobody.
 */

/** The tag the page was drawn for, the one the browser holds now, and a page drawn for two. */
export type IdentityTransition = { contaminated: boolean; from: string | null; to: string | null };

export type IdentityCover = {
  /**
   * Covers the page now, before its next paint, while this tab's own check of who holds the
   * session is under way ("Checking your account…"). On a page already covered by a check that
   * failed, it shows the check under way again (Try again hides).
   */
  cover: () => void;
  /** The check failed or took too long: the cover stays and offers Try again (`retry`) and Reload. */
  coverFailed: (retry: () => void) => void;
  /**
   * The page shows someone else than the browser holds now: the module keeps the cover ("This page
   * is out of date"), writes its guard and reloads the document, or offers Reload when it may not
   * reload on its own (a guard it couldn't read or write, or the same first decision a reloaded
   * document made before).
   */
  reset: (transition: IdentityTransition) => void;
  /** The check found the learner the page was drawn for: the cover comes off. Only the store calls it. */
  uncover: () => void;
};

/**
 * What the module's parse-time bootstrap found before the store ran: the hint as the page was
 * parsed (`seen`: a tag, null for nobody, undefined when the hint names no learner — absent, an
 * old `1` or unreadable), and the tags the page's private witnesses carried, in document order.
 */
export type IdentityHandoff = { seen: string | null | undefined; witnesses: readonly string[] };
