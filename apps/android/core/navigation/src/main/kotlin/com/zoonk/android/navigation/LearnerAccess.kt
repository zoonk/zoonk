package com.zoonk.android.navigation

/** Who the shell shows screens to, from the session and the learner summary. */
enum class LearnerAccess {
    /** Restoring the stored session: gated screens wait, so no gate flashes before it's read. */
    Restoring,
    Unavailable,
    Visitor,

    /** The stored session ended: log in again, since the plan is still there. */
    SessionEnded,

    /** Signed in, the summary not read yet: screens load as for a learner with a goal. */
    SignedIn,
    NoGoal,
    Learner,
}
