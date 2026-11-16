package com.zoonk.android.feature.warmup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class WaitPresentationTest {
    @Test fun readinessEndsTheWaitQuiz() {
        assertFalse(WaitPresentation(true, 0, 2).showQuiz)
    }

    @Test fun zeroDoneHasNoFilledProgress() {
        assertEquals(0f, WaitPresentation(false, 0, 2).progress, 0f)
    }

    @Test fun completedCountAndProgressAgree() {
        assertEquals(0.5f, WaitPresentation(false, 1, 2).progress, 0f)
    }

    @Test fun aFinishedWaitIsFull() {
        assertEquals(1f, WaitPresentation(true, 2, 2).progress, 0f)
    }
}
