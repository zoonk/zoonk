package com.zoonk.android.feature.player.engine

import org.junit.Assert.assertFalse
import org.junit.Test

class LessonEndProgressTest {
    @Test fun theEndDoesNotShowPartialProgress() {
        val state = LessonPlayerState.initial("lesson", emptyList(), 0)
        assertFalse(state.screen().showProgress)
    }
}
