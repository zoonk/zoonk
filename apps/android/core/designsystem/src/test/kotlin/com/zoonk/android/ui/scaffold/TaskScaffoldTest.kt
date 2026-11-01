package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.LocalSnackbarHostState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class TaskScaffoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var closed = 0

    private val confirmation =
        TaskExitConfirmation(
            title = "Leave your essay?",
            description = "Your draft stays on this device.",
            confirm = "Leave",
            cancel = "Keep writing",
        )

    private fun show(
        exitConfirmation: TaskExitConfirmation?,
        title: @Composable () -> Unit = { Text("Essay") },
    ) {
        rule.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                TaskScaffold(
                    onClose = { closed++ },
                    title = title,
                    exitConfirmation = exitConfirmation,
                    bottomBar = { Text("Hand in") },
                ) { Text("Draft") }
            }
        }
    }

    private fun pressBack() = rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }

    @Test
    fun closesAtOnceWithNothingToLose() {
        show(exitConfirmation = null)

        rule.onNodeWithText("Hand in").assertIsDisplayed()
        rule.onNodeWithContentDescription("Leave").performClick()

        assertEquals(1, closed)
    }

    @Test
    fun asksBeforeLeavingUnsentWorkOnCloseAndBack() {
        show(confirmation)

        rule.onNodeWithContentDescription("Leave").performClick()
        rule.onNodeWithText("Leave your essay?").assertIsDisplayed()
        rule.onNodeWithText("Keep writing").performClick()
        rule.onNodeWithText("Leave your essay?").assertDoesNotExist()

        pressBack()
        rule.onNodeWithText("Your draft stays on this device.").assertIsDisplayed()
        assertEquals(0, closed)

        rule.onNodeWithText("Leave").performClick()
        rule.runOnIdle { assertEquals(1, closed) }
    }

    /** However long it is, the title stays over the page before the fold. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun keepsALongTitleBeforeAnOpenBooksFold() {
        show(exitConfirmation = null, title = { Box(Modifier.fillMaxWidth().testTag("title")) })
        rule.waitForIdle()
        val fold = FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()

        val title = rule.onNodeWithTag("title").getUnclippedBoundsInRoot()
        assertTrue("the title ends before the fold: $title", title.right <= 426.dp)
    }

    /** Across an unfolded book foldable: the title sits over the page before the fold, and the actions over the page after it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun keepsItsTitleAndActionsOffAnOpenBooksFold() {
        show(exitConfirmation = null)
        rule.waitForIdle()
        val fold =
            FoldingFeature(rule.activity, state = FoldingFeature.State.HALF_OPENED, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        rule.waitForIdle()

        val title = rule.onNodeWithText("Essay").getUnclippedBoundsInRoot()
        val actions = rule.onNodeWithText("Hand in").getUnclippedBoundsInRoot()
        assertTrue("the title ends before the fold: $title", title.right <= 426.dp)
        assertTrue("the actions start after the fold: $actions", actions.left >= 426.dp)
    }

    /**
     * A run drops its aside across an unfolded book's fold, where its passage leads the page before
     * the fold, and takes it back on a phone, so folding swaps one for the other.
     */
    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun keepsWhatTheTaskHoldsAsItsAsideComesAndGoes() {
        val passage = TaskAside { Text("Passage") }
        var aside by mutableStateOf<TaskAside?>(passage)
        rule.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                TaskScaffold(onClose = {}, aside = aside) { padding ->
                    var picks by rememberSaveable { mutableIntStateOf(0) }
                    Button(onClick = { picks++ }, modifier = Modifier.padding(padding)) { Text("Picked $picks") }
                }
            }
        }
        rule.onNodeWithText("Picked 0").performClick()

        aside = null
        rule.waitForIdle()
        rule.onNodeWithText("Picked 1").assertIsDisplayed()

        aside = passage
        rule.waitForIdle()
        rule.onNodeWithText("Picked 1").assertIsDisplayed()
    }
}
