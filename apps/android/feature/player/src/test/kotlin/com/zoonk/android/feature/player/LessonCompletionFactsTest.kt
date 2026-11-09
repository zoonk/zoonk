package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.LessonCompletion
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.StudyBlockCompletion
import org.junit.Assert.assertEquals
import org.junit.Test

class LessonCompletionFactsTest {
    @Test fun onlyASavedCompletionWithMovedLessonsHasTheDeferredFact() {
        val block = decodeFixture<StudyBlockCompletion>("study-block-completion")
        val completion = ApiJson.decodeFromString<LibraryLessonCompletion>(COMPLETION)
        listOf(0L, 1L, 3L).forEach { count ->
            val deferred = block.copy(deferredLessonsCount = count, minutes = block.minutes.copy(dailyGoal = 240.5, left = 210.5))
            CompletionStatus.entries.forEach { status ->
                val state = LessonCompletion(status, completion.copy(studyBlock = deferred))
                assertEquals(if (status == CompletionStatus.Saved && count > 0) deferred else null, state.deferredBlock)
            }
        }
        assertEquals(null, LessonCompletion(CompletionStatus.Saved, completion).deferredBlock)
    }
}
