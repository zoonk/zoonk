package com.zoonk.android.feature.activities.sorting

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.checkResult
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Main's timeline tests. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class TimelineFlowTest : SortingFlow() {
    private fun slider(event: String) =
        rule.onNode(hasContentDescription(event) and SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))

    private fun sliderSays(
        event: String,
        value: String,
    ) = slider(event).assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, value))

    @Test
    fun timelineEventsPlacedInOrderAreRightAndTheRealGapsShow() {
        play("timeline", isCorrect = true)

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        slider("Moon landing").assertIsFocused().performKeyInput { pressKey(Key.MoveEnd) }
        sliderSays("Moon landing", "2000\u00A0CE")
        rule.onNodeWithContentDescription("Place Cleopatra rules Egypt on the timeline").performScrollTo().performClick()
        harness.tap("Check")

        shows("about 2,000 years")
        shows("about 2,500 years")
        assertTrue(sentAnswer(), sentAnswer().contains(""""ids":["cleo","moon"]"""))
    }

    @Test
    fun timelineEventsInTheWrongOrderAreWrongWithTheRealDates() {
        play("timeline", isCorrect = false)

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Place Cleopatra rules Egypt on the timeline").performScrollTo().performClick()
        slider("Cleopatra rules Egypt").performKeyInput { pressKey(Key.MoveEnd) }
        harness.tap("Check")

        sliderSays("Cleopatra rules Egypt", "51\u00A0BCE. Your guess: 2000\u00A0CE")
    }

    @Test
    fun timelineWithAQuestionShowsTheRealDatesBeforeAnswering() {
        play(
            "timeline",
            isCorrect = true,
            check = choiceCheck("Cleopatra lived closer in time to...", "The Moon landing", "The pyramid builders"),
        )

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Place Cleopatra rules Egypt on the timeline").performScrollTo().performClick()
        tap("Show the real dates")
        shows("about 2,000 years")
        tap("The Moon landing")
        harness.tap("Check")

        shows("about 2,000 years")
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp")
    fun timelineAnEventHeldAndDraggedOntoTheAxisLandsWhereItIsDropped() {
        play("timeline", isCorrect = true)
        val tray = rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo()
        val track = rule.onNodeWithContentDescription("A timeline from 3000\u00A0BCE to 2000\u00A0CE.").fetchSemanticsNode().boundsInRoot
        val start = tray.fetchSemanticsNode().boundsInRoot.topLeft
        val to = Offset(track.center.x, track.top + with(rule.density) { NEAR_THE_START.toPx() }) - start

        tray.performTouchInput {
            holdAndDrag(to)
            up()
        }

        slider("Moon landing").assert(SemanticsMatcher("BCE") { it.config[SemanticsProperties.StateDescription].endsWith("BCE") })
    }

    private fun nearTheStart(from: androidx.compose.ui.test.SemanticsNodeInteraction): Offset {
        val track = rule.onNodeWithContentDescription("A timeline from 3000\u00A0BCE to 2000\u00A0CE.").fetchSemanticsNode().boundsInRoot
        val start = from.fetchSemanticsNode().boundsInRoot.topLeft
        return Offset(track.center.x, track.top + with(rule.density) { NEAR_THE_START.toPx() }) - start
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp")
    fun timelineTheNextEventInTheTrayIsTheOneDragged() {
        play("timeline", isCorrect = true)

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        val tray = rule.onNodeWithContentDescription("Place Cleopatra rules Egypt on the timeline").performScrollTo()
        val to = nearTheStart(tray)
        tray.performTouchInput {
            holdAndDrag(to)
            up()
        }

        sliderSays("Moon landing", "500\u00A0BCE")
        slider("Cleopatra rules Egypt").assertExists()
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp")
    fun timelineADragTheSystemTakesBackKeepsTheLastMove() {
        play("timeline", isCorrect = true)

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        slider("Moon landing").performKeyInput { pressKey(Key.MoveEnd) }
        sliderSays("Moon landing", "2000\u00A0CE")
        val card = slider("Moon landing")
        val to = nearTheStart(card)
        card.performTouchInput { holdAndDrag(to) }
        slider("Moon landing").assert(SemanticsMatcher("BCE") { it.config[SemanticsProperties.StateDescription].endsWith("BCE") })
        card.performTouchInput { cancel() }

        sliderSays("Moon landing", "2000\u00A0CE")
    }

    @Test
    fun timelineKeepsTheRealDatesHiddenWhileTheAnswerIsChecked() {
        val gate = CompletableDeferred<Unit>()
        harness.play(
            listOf(
                ActivityFixtures.step(
                    "timeline",
                    check = choiceCheck("Cleopatra lived closer in time to...", "The Moon landing", "The pyramid builders"),
                ),
            ),
        ) {
            this.gate = gate
            grade = { _, _ -> checkResult(true, expected = ActivityFixtures.expected("timeline")) }
        }

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Place Cleopatra rules Egypt on the timeline").performScrollTo().performClick()
        tap("The Moon landing")
        harness.tap("Check")

        rule.onNodeWithText("Show the real dates").assertIsNotEnabled()
        gate.complete(Unit)
    }

    @Test
    fun timelineTakesTheYearTalkBackSets() {
        play("timeline", isCorrect = true)

        rule.onNodeWithContentDescription("Place Moon landing on the timeline").performScrollTo().performClick()
        slider("Moon landing").performSemanticsAction(SemanticsActions.SetProgress) { it(1969f) }

        sliderSays("Moon landing", "1950\u00A0CE")
    }
}

private val NEAR_THE_START = 40.dp
