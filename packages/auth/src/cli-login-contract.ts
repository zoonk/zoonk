/** The CLI's public OAuth client; the migration that created the OAuth tables registered it. */
export const CLI_CLIENT_ID = "zoonk-cli";

export const STAFF_READ_SCOPE = "staff:read";

export const STAFF_PROPOSE_SCOPE = "staff:propose";

/** The browser page where a signed-in person approves a CLI login, relative to Main. */
export const CLI_LOGIN_APPROVAL_PATH = "/device";

/** One-time repairs of learner data after a release, granted only to a login that asks for it. */
export const STAFF_REPAIR_SCOPE = "staff:repair";
