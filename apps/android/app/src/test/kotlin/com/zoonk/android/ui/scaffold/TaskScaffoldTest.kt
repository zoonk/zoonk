package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TaskScaffoldTest {
    @get:Rule
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
}
