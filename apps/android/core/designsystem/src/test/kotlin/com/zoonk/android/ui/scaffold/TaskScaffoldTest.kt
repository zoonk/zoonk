package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
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

    private fun show(exitConfirmation: TaskExitConfirmation?) {
        rule.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                TaskScaffold(
                    onClose = { closed++ },
                    title = { Text("Essay") },
                    exitConfirmation = exitConfirmation,
                    bottomBar = { Text("Hand in") },
                ) { Text("Draft") }
            }
        }
    }

    private fun pressBack() = rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }

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

    /** Opening the book moves the title, never the actions, so what an action opened (a report's sheet and its draft) stays open. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun keepsWhatAnActionOpenedAsTheBookOpens() {
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    TaskScaffold(
                        onClose = {},
                        actions = {
                            var open by rememberSaveable { mutableStateOf(false) }
                            TextButton(onClick = { open = true }) { Text(if (open) "Report open" else "Report") }
                        },
                    ) {}
                }
            }
        }
        rule.onNodeWithText("Report").performClick()

        rule.unfoldBook(folds)

        rule.onNodeWithText("Report open").assertIsDisplayed()
    }
}
