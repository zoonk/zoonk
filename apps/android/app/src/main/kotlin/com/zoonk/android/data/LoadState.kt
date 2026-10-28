package com.zoonk.android.data

/** What a screen shows for one piece of server data. */
sealed interface LoadState<out T> {
    /** Nothing loaded yet, or dropped (signed out, another session). */
    data object Idle : LoadState<Nothing>

    /** The first load, with nothing cached to show meanwhile. */
    data object Loading : LoadState<Nothing>

    data class Loaded<T>(
        val value: T,
    ) : LoadState<T>

    /** Loaded, with nothing to show. */
    data object Empty : LoadState<Nothing>

    data class Failed(
        val error: ApiError,
    ) : LoadState<Nothing>
}

val LoadState<*>.hasContent: Boolean get() = this is LoadState.Loaded || this is LoadState.Empty

/** The loaded value, or null while there's none. */
val <T> LoadState<T>.value: T? get() = (this as? LoadState.Loaded)?.value

/** Whose data a resource holds, which decides what a session change does to it. */
enum class Audience {
    /** Public data that doesn't depend on who reads it, such as the catalog. Kept across sessions. */
    Everyone,

    /** Public data a signed-in reader sees personalized, such as a course with its progress. */
    Viewer,

    /** The signed-in learner's own data. Idle while signed out. */
    SignedIn,
}

/**
 * What a write can change, mirroring the per-learner cache tags in `packages/core/src/cache/tags.ts`:
 * a mutation names the domains it changed, and every resource reading one of them revalidates.
 */
enum class DataDomain {
    Allowance,
    Goals,
    InstrumentWaitlist,
    LearnerModel,
    LearningProfile,
    Memory,
    UserProgress,
    UserSession,
    UserSubscription,
}
