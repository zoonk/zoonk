package com.zoonk.android.feature.player.engine

import androidx.compose.runtime.Immutable
import com.zoonk.android.ui.components.Limit

/** Why the run, or a piece of AI help, was refused. None is a dead end: each screen offers a way on. */
@Immutable
sealed interface LessonRefusal {
    data object Failed : LessonRefusal

    data object NotFound : LessonRefusal

    data object PlusRequired : LessonRefusal

    /** A screen the lesson needs is of a kind this app can't show yet. */
    data object NotInApp : LessonRefusal

    /** A slow-down, a used-up allowance, or a guest who needs an account. */
    data class Limited(
        val limit: Limit,
    ) : LessonRefusal
}
