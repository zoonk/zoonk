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

/** Main's labeled diagram and dragging tests. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class LabeledDiagramFlowTest : SortingFlow() {
    private fun labelSpots(names: List<String>) =
        names.forEachIndexed { index, name ->
            rule.onNodeWithContentDescription("Put $name on spot ${index + 1}").performScrollTo().performClick()
        }

    @Test
    fun labeledDiagramEveryNameOnItsPartIsRight() {
        play("labeledDiagram", isCorrect = true)

        labelSpots(HEART_SPOTS)
        shows("Every spot has a name. Tap a spot to change it.")
        harness.tap("Check")

        HEART_SPOTS.forEachIndexed { index, name -> rule.onNodeWithContentDescription("Spot ${index + 1}: $name").assertExists() }
    }

    @Test
    fun labeledDiagramASwappedPairShowsTheWritersMixUpFeedback() {
        play("labeledDiagram", isCorrect = false)

        labelSpots(listOf("Left atrium", "Right atrium", "Right ventricle", "Left ventricle", "Aorta"))
        rule.onNodeWithContentDescription("Spot 5: Aorta").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Put Aorta on spot 5").performScrollTo().performClick()
        harness.tap("Check")

        assertEquals(2, rule.onAllNodes(hasText(HEART_MIX_UP)).fetchSemanticsNodes().size)
    }

    @Test
    fun labeledDiagramWithOnlyAKeyboard() {
        play("labeledDiagram", isCorrect = true)

        HEART_SPOTS.forEachIndexed { index, name ->
            press(rule.onNodeWithContentDescription("Put $name on spot ${index + 1}"), Key.Enter)
            rule.onNodeWithContentDescription("Spot ${index + 1}: $name").assertExists()
        }
        press(rule.onNodeWithText("Check"), Key.Enter)

        rule.onNodeWithContentDescription("Spot 1: Right atrium").assertExists()
    }

    @Test
    fun labeledDiagramANameHeldAndDraggedOntoASpotLabelsIt() {
        play("labeledDiagram", isCorrect = true)
        val spot = rule.onNodeWithContentDescription("Spot 3: empty").performScrollTo()
        val name = rule.onNodeWithContentDescription("Put Right ventricle on spot 1")
        val to = centerOf(spot, name)

        name.performTouchInput {
            holdAndDrag(to)
            up()
        }

        rule.onNodeWithContentDescription("Spot 3: Right ventricle").assertExists()
        announces("Right ventricle on spot 3.")
    }

    @Test
    fun labeledDiagramAQuickSwipeOverTheNamesDoesNotPlaceOne() {
        play("labeledDiagram", isCorrect = true)
        val spot = rule.onNodeWithContentDescription("Spot 3: empty").performScrollTo()
        val name = rule.onNodeWithContentDescription("Put Aorta on spot 1")
        val to = centerOf(spot, name)

        name.performTouchInput { swipe(center, to, durationMillis = SWIPE_MILLIS) }

        rule.onNodeWithContentDescription("Spot 3: empty").assertExists()
        rule.onNodeWithContentDescription("Put Aorta on spot 1").assertExists()
    }

    @Test
    fun labeledDiagramTakesTalkBackActionsThatPutANameOnASpot() {
        play("labeledDiagram", isCorrect = true)

        rule.onNodeWithContentDescription("Put Aorta on spot 1").performCustomAction("Put Aorta on spot 5")

        rule.onNodeWithContentDescription("Spot 5: Aorta").assertExists()
    }
}

private val HEART_SPOTS = listOf("Right atrium", "Left atrium", "Right ventricle", "Left ventricle", "Aorta")
private const val HEART_MIX_UP = "The picture faces you, so the heart's right side is on your left."
