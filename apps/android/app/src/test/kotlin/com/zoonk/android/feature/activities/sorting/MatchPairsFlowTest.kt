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
