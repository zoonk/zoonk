package com.zoonk.android.feature.activities.sorting

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Main's match pairs tests. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class MatchPairsFlowTest : SortingFlow() {
    private fun matchCards(
        left: String,
        right: String,
    ) {
        rule.onNodeWithText(left).performScrollTo().performClick()
        rule.onNodeWithText(right).performScrollTo().performClick()
    }

    @Test
    fun matchPairsMatchingEachPairOnTheFirstTryIsRight() {
        play("matchPairs", isCorrect = true)

        matchCards("embarazada", "pregnant")
        matchCards("éxito", "success")
        matchCards("librería", "bookstore")

        shows("3 of 3 pairs matched · 2 cards have no match")
        rule.onNodeWithContentDescription("embarrassed, no match").assertIsNotEnabled()
        rule.onNodeWithContentDescription("library, no match").assertIsNotEnabled()
        harness.tap("Check")

        shows("Look-alikes with no match")
    }

    @Test
    fun matchPairsATrapExplainsItselfStaysMarkedAndTheFirstTryCounts() {
        play("matchPairs", isCorrect = false)

        matchCards("embarazada", "embarrassed")

        shows("“embarrassed” has no match. Embarrassed is avergonzada in Spanish. Embarazada looks like it but means pregnant.")
        rule.onNodeWithContentDescription("embarrassed, no match").assertIsNotEnabled()
        rule.onNodeWithText("Check").assertIsNotEnabled()
        matchCards("embarazada", "pregnant")
        matchCards("éxito", "success")
        matchCards("librería", "bookstore")
        harness.tap("Check")

        shows("embarazada goes with pregnant, not embarrassed.")
        assertTrue(sentAnswer(), sentAnswer().contains(""""a":"right-trap-0""""))
    }
}
