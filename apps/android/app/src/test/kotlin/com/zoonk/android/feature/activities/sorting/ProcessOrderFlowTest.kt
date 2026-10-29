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

/** Main's process order tests. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class ProcessOrderFlowTest : SortingFlow() {
    private fun stepOrder(): List<String> =
        rule
            .onNodeWithContentDescription("Steps, in your order")
            .onChildren()
            .fetchSemanticsNodes()
            .map { it.config[SemanticsProperties.Text].joinToString(" ") }

    private fun moveStep(
        step: String,
        from: Int,
        to: Int,
    ) {
        val row = rule.onNodeWithText(step)
        press(row, Key.Spacebar)
        announces("Picked up $step at position $from.")
        val (key, direction) = if (to < from) Key.DirectionUp to -1 else Key.DirectionDown to 1
        (1..abs(to - from)).forEach {
            row.performKeyInput { pressKey(key) }
            announces("$step is over position ${from + direction * it}.")
        }
        row.performKeyInput { pressKey(Key.Spacebar) }
        announces("$step dropped at position $to.")
        assertEquals(step, stepOrder()[to - 1])
    }

    private fun sortSteps(expected: List<String>) {
        assertEquals(PHOTOSYNTHESIS.size, stepOrder().size)
        expected.forEachIndexed { index, step ->
            val current = stepOrder().indexOf(step)
            if (current != index) moveStep(step, from = current + 1, to = index + 1)
        }
    }

    @Test
    fun processOrderSortedWithTheKeyboardIsRight() {
        play("processOrder", isCorrect = true)

        sortSteps(PHOTOSYNTHESIS)
        harness.tap("Check")

        shows("The Calvin cycle runs on the ATP and NADPH that light made.")
        assertTrue(sentAnswer(), sentAnswer().contains(PHOTOSYNTHESIS_IDS.joinToString(",") { "\"$it\"" }))
    }

    @Test
    fun processOrderSaysWhereTheLearnerHadStepsOutOfPlace() {
        play("processOrder", isCorrect = false)

        sortSteps(listOf(PHOTOSYNTHESIS[0], PHOTOSYNTHESIS[1], PHOTOSYNTHESIS[3]))
        harness.tap("Check")

        shows("The right order")
        rule.onAllNodes(hasText("You had it at", substring = true)).onFirst().assertExists()
    }

    @Test
    fun processOrderEscapePutsALiftedStepBack() {
        play("processOrder", isCorrect = true)
        val before = stepOrder()
        val row = rule.onNodeWithText(before[0])

        press(row, Key.Spacebar)
        row.performKeyInput { pressKey(Key.DirectionDown) }
        row.performKeyInput { pressKey(Key.Escape) }

        announces("Stopped moving ${before[0]}. It stays where it was.")
        assertEquals(before, stepOrder())
    }

    @Test
    fun processOrderMovesAStepWithTalkBackActions() {
        play("processOrder", isCorrect = true)
        val before = stepOrder()

        rule.onNodeWithText(before[1]).performCustomAction("Move up")

        assertEquals(listOf(before[1], before[0]) + before.drop(2), stepOrder())
        announces("${before[1]} dropped at position 1.")
    }

    @Test
    fun processOrderAStepHeldAndDraggedDownTakesItsNewPlace() {
        play("processOrder", isCorrect = true)
        val before = stepOrder()
        val first = rule.onNodeWithText(before[0])
        val third = rule.onNodeWithText(before[2])
        val to = centerOf(third, first)

        first.performTouchInput {
            holdAndDrag(Offset(center.x, to.y))
            up()
        }

        assertEquals(listOf(before[1], before[2], before[0]) + before.drop(3), stepOrder())
    }

    @Test
    fun processOrderADragTheSystemTakesBackKeepsTheOrder() {
        play("processOrder", isCorrect = true)
        val before = stepOrder()
        val first = rule.onNodeWithText(before[0])
        val to = centerOf(rule.onNodeWithText(before[2]), first)

        first.performTouchInput {
            holdAndDrag(Offset(center.x, to.y))
            cancel()
        }

        assertEquals(before, stepOrder())
    }
}

private val PHOTOSYNTHESIS =
    listOf(
        "Chlorophyll absorbs sunlight",
        "Water is split, releasing oxygen",
        "Light energy is stored in ATP and NADPH",
        "The Calvin cycle builds sugar from CO₂",
        "The plant stores sugar as starch",
    )
private val PHOTOSYNTHESIS_IDS = listOf("absorb", "split", "store", "calvin", "starch")
