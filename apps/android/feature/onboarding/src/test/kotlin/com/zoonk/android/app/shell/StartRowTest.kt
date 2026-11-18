package com.zoonk.android.app.shell

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StartRowTest {
    @Test
    fun noGoalsAtAllIsThePlainStartRow() {
        assertTrue(showsStartRow(followed = 0, waiting = 0, explanations = 0))
    }

    @Test
    fun oneQuickExplanationAloneIsThePlainStartRow() {
        assertTrue(showsStartRow(followed = 0, waiting = 0, explanations = 1))
    }

    @Test
    fun twoQuickExplanationsKeepTheMenuSoTheOlderOneStaysInReach() {
        assertFalse(showsStartRow(followed = 0, waiting = 0, explanations = 2))
    }

    @Test
    fun aGoalWaitingToStartOpensTheMenu() {
        assertFalse(showsStartRow(followed = 0, waiting = 1, explanations = 0))
    }

    @Test
    fun aFollowedGoalOpensTheMenu() {
        assertFalse(showsStartRow(followed = 1, waiting = 0, explanations = 1))
    }
}
