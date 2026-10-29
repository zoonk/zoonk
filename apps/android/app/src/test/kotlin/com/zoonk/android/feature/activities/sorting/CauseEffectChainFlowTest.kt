package com.zoonk.android.feature.activities.sorting

import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.TouchInjectionScope
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onChildren
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performMouseInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.test.swipe
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepCheckInput
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import kotlin.math.abs

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
