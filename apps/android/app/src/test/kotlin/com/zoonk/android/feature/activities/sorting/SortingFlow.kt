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

/** Main's player tests for the sorting templates, played in the real player by tap, keyboard, TalkBack and drag. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
abstract class SortingFlow {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    internal val harness = LessonPlayerHarness(rule) { folder.newFolder() }
    private var sent: LessonStepCheckInput? = null

    protected fun play(
        fixture: String,
        isCorrect: Boolean,
        check: JsonObject? = null,
    ) = harness.play(listOf(ActivityFixtures.step(fixture, check = check))) {
        grade = { _, input ->
            sent = input
            checkResult(isCorrect, expected = ActivityFixtures.expected(fixture))
        }
    }

    protected fun sentAnswer() = ApiJson.encodeToString(LessonStepCheckInput.serializer(), checkNotNull(sent))

    protected fun node(text: String) = rule.onNodeWithText(text, substring = true).performScrollTo()

    protected fun tap(text: String) = node(text).performClick()

    protected fun shows(text: String) = node(text).assertIsDisplayed()

    protected fun press(
        node: SemanticsNodeInteraction,
        key: Key,
    ) {
        node.requestFocus()
        node.performKeyInput { pressKey(key) }
    }

    /** Where [target]'s center sits in [from]'s own coordinates, for a gesture that starts on [from]. */
    protected fun centerOf(
        target: SemanticsNodeInteraction,
        from: SemanticsNodeInteraction,
    ): Offset {
        val to = target.fetchSemanticsNode().boundsInRoot
        val start = from.fetchSemanticsNode().boundsInRoot
        return to.center - start.topLeft
    }

    protected fun TouchInjectionScope.holdAndDrag(to: Offset) {
        down(center)
        moveBy(Offset.Zero, delayMillis = viewConfiguration.longPressTimeoutMillis + HOLD_EXTRA)
        repeat(DRAG_MOVES) { moveTo(center + (to - center) * ((it + 1f) / DRAG_MOVES)) }
    }

    protected fun announces(text: String) = rule.onNode(hasContentDescription(text)).assertExists()

    protected fun SemanticsNodeInteraction.performCustomAction(label: String) {
        val action =
            fetchSemanticsNode().config[SemanticsActions.CustomActions].first { it.label == label }
        rule.runOnIdle { action.action() }
    }
}

/** Main's `choiceCheck`: the first option is right. */
internal fun choiceCheck(
    question: String,
    vararg options: String,
) = buildJsonObject {
    put("kind", "choice")
    put("question", question)
    putJsonArray("options") {
        options.forEachIndexed { index, text ->
            add(
                buildJsonObject {
                    put("id", "o$index")
                    put("isCorrect", index == 0)
                    put("reason", "Because of $text.")
                    put("text", text)
                },
            )
        }
    }
}

internal const val HOLD_EXTRA = 100L
internal const val DRAG_MOVES = 12
internal const val SWIPE_MILLIS = 150L
