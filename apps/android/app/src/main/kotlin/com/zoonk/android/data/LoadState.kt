package com.zoonk.android.data

sealed interface LoadState<out T> {
    /** Nothing loaded yet, or dropped (signed out, another session). */
    data object Idle : LoadState<Nothing>

    data object Loading : LoadState<Nothing>

    data class Loaded<T>(
        val value: T,
    ) : LoadState<T>

    data object Empty : LoadState<Nothing>

    data class Failed(
        val error: ApiError,
    ) : LoadState<Nothing>
}

val LoadState<*>.hasContent: Boolean get() = this is LoadState.Loaded || this is LoadState.Empty

val <T> LoadState<T>.value: T? get() = (this as? LoadState.Loaded)?.value

enum class Audience {
    /** The same for every reader, such as the catalog: kept across sessions. */
    Everyone,

    /** Public, but personalized for a signed-in reader (a course with its progress): dropped on a session change. */
    Viewer,

    /** The signed-in learner's own data. Idle while signed out. */
    SignedIn,
}

/** Mirrors the per-learner cache tags in `packages/core/src/cache/tags.ts`. */
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
