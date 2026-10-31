package com.zoonk.android.feature.player

import androidx.compose.runtime.Immutable
import com.zoonk.android.data.ApiException
import com.zoonk.android.feature.player.engine.LessonRefusal

@Immutable
sealed interface LessonWriting {
    /** Nothing writes it yet: it waits for "Start this lesson". */
    data object NotStarted : LessonWriting

    data object Starting : LessonWriting

    /** A run writes it, followed in [LessonWritingViewModel.run]. */
    data object Writing : LessonWriting

    /** Asking to write it failed; it shows as a run that didn't start. */
    data object Failed : LessonWriting

    data object Ready : LessonWriting

    /** Every draft was held back by its checks; plans go on without it. */
    data object SetAside : LessonWriting

    data class Refused(
        val refusal: LessonRefusal,
    ) : LessonWriting
}

/** Why the API won't write a lesson: set aside by its checks, or a refusal the learner should see; null for anything worth retrying. */
fun ApiException.toNotWritten(): LessonWriting? =
    if (code == "LESSON_SET_ASIDE") LessonWriting.SetAside else toLessonRefusal()?.let(LessonWriting::Refused)
