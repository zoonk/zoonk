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

/** Main's categorize and dragging tests. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class CategorizeFlowTest : SortingFlow() {
    private fun sortItem(
        item: String,
        group: String,
    ) {
        tap(item)
        rule.onNodeWithContentDescription("Put $item in $group").performScrollTo().performClick()
    }

    @Test
    fun categorizeEveryItemInItsGroupIsRight() {
        play("categorize", isCorrect = true)

        shows("0 of 3 sorted")
        sortItem("Burning wood", "New substance")
        sortItem("Melting ice", "Same substance")
        sortItem("Rusting iron", "New substance")
        shows("All sorted. Check when you're ready.")
        harness.tap("Check")

        shows("3 of 3 in the right group")
        listOf("i1" to "chemical", "i2" to "physical", "i3" to "chemical").forEach { (item, group) ->
            assertTrue(sentAnswer(), sentAnswer().contains(""""$item":"$group""""))
        }
    }

    @Test
    fun categorizeSaysWhereAMisplacedItemBelongsAndWhy() {
        play("categorize", isCorrect = false)

        sortItem("Burning wood", "Same substance")
        sortItem("Melting ice", "Same substance")
        sortItem("Rusting iron", "New substance")
        harness.tap("Check")

        shows("Burning wood belongs in New substance.")
        shows("Ash and gas form.")
        rule.onNodeWithContentDescription("Burning wood, wrong group").assertExists()
        rule.onNodeWithContentDescription("Melting ice, right group").assertExists()
    }

    @Test
    fun categorizeWithOnlyAKeyboard() {
        play("categorize", isCorrect = true)

        listOf(
            "Burning wood" to "New substance",
            "Melting ice" to "Same substance",
            "Rusting iron" to "New substance",
        ).forEach { (item, group) ->
            press(rule.onNodeWithText(item), Key.Spacebar)
            press(rule.onNodeWithContentDescription("Put $item in $group"), Key.Spacebar)
        }
        press(rule.onNodeWithText("Check"), Key.Enter)

        shows("3 of 3 in the right group")
    }

    @Test
    fun categorizeTakesTalkBackActionsThatPutAnItemInAGroup() {
        play("categorize", isCorrect = true)

        rule.onNodeWithText("Melting ice").performCustomAction("Put Melting ice in Same substance")

        shows("1 of 3 sorted")
        rule.onNode(hasText("Melting ice") and hasAnyAncestor(hasText("Same substance"))).assertExists()
        rule.onNode(hasContentDescription("Melting ice is in Same substance. 1 of 3 sorted.")).assertExists()
    }

    @Test
    fun categorizeAnItemHeldAndDraggedOntoAGroupIsSortedIntoIt() {
        play("categorize", isCorrect = true)
        val group = node("New substance")
        val item = node("Burning wood")

        item.performTouchInput {
            holdAndDrag(centerOf(group, item))
            up()
        }

        shows("1 of 3 sorted")
        rule.onNode(hasText("Burning wood") and hasAnyAncestor(hasText("New substance"))).assertExists()
    }

    @Test
    fun categorizeAnItemDraggedWithAMouseOntoAGroupIsSortedIntoIt() {
        play("categorize", isCorrect = true)
        val group = node("Same substance")
        val item = node("Melting ice")
        val to = centerOf(group, item)

        item.performMouseInput {
            moveTo(center)
            press()
            repeat(DRAG_MOVES) { moveTo(center + (to - center) * ((it + 1f) / DRAG_MOVES)) }
            release()
        }

        shows("1 of 3 sorted")
        rule.onNode(hasText("Melting ice") and hasAnyAncestor(hasText("Same substance"))).assertExists()
    }

    @Test
    fun categorizeADragTheSystemTakesBackPutsTheItemBack() {
        play("categorize", isCorrect = true)
        val group = node("New substance")
        val item = node("Burning wood")

        item.performTouchInput {
            holdAndDrag(centerOf(group, item))
            cancel()
        }

        shows("0 of 3 sorted")
        rule.onNode(hasText("Burning wood") and hasAnyAncestor(hasText("New substance"))).assertDoesNotExist()
    }

    @Test
    fun categorizeAQuickSwipeOverAnItemDoesNotLiftIt() {
        play("categorize", isCorrect = true)
        val group = node("New substance")
        val item = node("Burning wood")
        val to = centerOf(group, item)

        item.performTouchInput { swipe(center, to, durationMillis = SWIPE_MILLIS) }

        shows("0 of 3 sorted")
        assertEquals(0, rule.onAllNodes(hasText("Burning wood") and hasAnyAncestor(hasText("New substance"))).fetchSemanticsNodes().size)
    }
}
