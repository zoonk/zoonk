package com.zoonk.android.feature.activities.sorting

import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.pressKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Main's cause and effect tests. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class CauseEffectChainFlowTest : SortingFlow() {
    /** A cause or effect's own card, not a link that names it. */
    private fun link(node: String) = rule.onNodeWithText(node).performScrollTo().performClick()

    @Test
    fun causeEffectLinkingBothCausesToTheStormsIsRight() {
        play("causeEffectChain", isCorrect = true)

        link("Prairie plowed for wheat")
        link("Dust storms")
        link("Years of drought")
        link("Dust storms")
        shows("2 of 2 links")
        harness.tap("Check")

        shows("Bare soil blew away.")
        assertTrue(sentAnswer(), sentAnswer().contains(""""links":[{"from":"plow","to":"dust"},{"from":"drought","to":"dust"}]"""))
    }

    @Test
    fun causeEffectABackwardLinkIsWrongAndTheMissedOnesShow() {
        play("causeEffectChain", isCorrect = false)

        link("Dust storms")
        link("Prairie plowed for wheat")
        harness.tap("Check")

        shows("Not a link in this story")
        assertEquals(2, rule.onAllNodes(hasText("Missed link")).fetchSemanticsNodes().size)
    }

    @Test
    fun causeEffectWithAQuestionConfirmsEachLinkAtOnce() {
        play(
            "causeEffectChain",
            isCorrect = true,
            check = choiceCheck("Why did the storms get so bad?", "Plowing and drought together", "Only the drought"),
        )

        link("Dust storms")
        link("Prairie plowed for wheat")
        shows("didn't lead straight to")
        link("Prairie plowed for wheat")
        link("Dust storms")
        shows("Bare soil blew away.")
        tap("Plowing and drought together")
        harness.tap("Check")

        shows("Bare soil blew away.")
    }

    @Test
    fun causeEffectWithOnlyAKeyboard() {
        play("causeEffectChain", isCorrect = true)
        val plow = rule.onNodeWithText("Prairie plowed for wheat")
        val drought = rule.onNodeWithText("Years of drought")
        val dust = rule.onNodeWithText("Dust storms")

        press(plow, Key.Enter)
        press(dust, Key.Enter)
        press(drought, Key.Enter)
        drought.performKeyInput { pressKey(Key.Escape) }
        shows("Pick a cause, then pick what it led to.")
        drought.performKeyInput { pressKey(Key.Enter) }
        press(dust, Key.Enter)
        shows("2 of 2 links")
        press(rule.onNodeWithText("Check"), Key.Enter)

        shows("Bare soil blew away.")
    }

    @Test
    fun causeEffectRemovesALinkFromItsList() {
        play("causeEffectChain", isCorrect = true)

        link("Years of drought")
        link("Dust storms")
        shows("1 of 2 links")
        rule.onNodeWithContentDescription("Remove the link from Years of drought to Dust storms").performScrollTo().performClick()

        shows("0 of 2 links")
    }
}
