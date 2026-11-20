package com.zoonk.android.app.shell

import org.junit.Assert.assertEquals
import org.junit.Test

class TriggerTitleTest {
    @Test
    fun goalsWaitingToStartAreYourGoals() {
        assertEquals(TriggerTitle.YourGoals, triggerTitle(waiting = 1, explanations = 2))
    }

    @Test
    fun twoQuickExplanationsAloneNameTheMenuTheyOpen() {
        assertEquals(TriggerTitle.QuickExplanations, triggerTitle(waiting = 0, explanations = 2))
    }
}
