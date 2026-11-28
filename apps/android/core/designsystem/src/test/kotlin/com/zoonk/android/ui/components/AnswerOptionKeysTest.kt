package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * With a keyboard, Enter on a focused answer goes on to the screen's main action, as a radio's does in main's forms, and
 * Space picks it.
 */
@RunWith(AndroidJUnit4::class)
class AnswerOptionKeysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var picks by mutableStateOf(emptyList<Int>())
    private var checked by mutableStateOf(false)
    private var mainPresses by mutableIntStateOf(0)

    /** Three answers in a frame that, as a task's does, runs its main action on Enter once per press, checking them. */
    private fun showAnswers(
        role: Role,
        keepsEnter: Boolean = false,
    ) {
        val frame = FocusRequester()
        lateinit var inputModes: InputModeManager
        compose.setContent {
            inputModes = LocalInputModeManager.current
            ZoonkTheme {
                Surface {
                    Column(
                        Modifier.focusRequester(frame).focusable().onKeyEvent { event ->
                            val enter = event.type == KeyEventType.KeyDown && (event.key == Key.Enter || event.key == Key.NumPadEnter)
                            if (enter && event.nativeKeyEvent.repeatCount == 0) {
                                mainPresses++
                                checked = true
                            }
                            enter
                        },
                    ) {
                        AnswerOptionGroup {
                            repeat(3) { index ->
                                AnswerOption(
                                    marker = index + 1,
                                    picked = index in picks,
                                    result = null,
                                    onClick = { picks = if (index in picks) picks - index else picks + index },
                                    enabled = !checked,
                                    role = role,
                                    keepsEnter = keepsEnter,
                                ) { Text("Option ${index + 1}") }
                            }
                        }
                    }
                }
            }
        }
        // A key press puts the window in keyboard mode, where an answer takes focus.
        compose.runOnIdle {
            assertTrue(inputModes.requestInputMode(InputMode.Keyboard))
            assertTrue(frame.requestFocus())
        }
    }

    private fun focusSecondAnswer() {
        compose.onRoot().performKeyInput {
            pressKey(Key.Tab)
            pressKey(Key.Tab)
        }
        compose.onNodeWithText("Option 2").assertIsFocused()
    }

    private fun assertEnterPressesTheMainAction(role: Role) {
        showAnswers(role)
        picks = listOf(0, 1)
        focusSecondAnswer()

        compose.onRoot().performKeyInput { pressKey(Key.Enter) }
        compose.waitForIdle()

        assertEquals(1, mainPresses)
        assertEquals(listOf(0, 1), picks)
    }

    @Test
    fun `Enter on a focused pick-one answer presses the main action and keeps the pick`() =
        assertEnterPressesTheMainAction(Role.RadioButton)

    @Test
    fun `Enter on a focused pick-several answer presses the main action and keeps the picks`() =
        assertEnterPressesTheMainAction(Role.Checkbox)

    @Test
    fun `NumPad Enter on a focused answer presses the main action`() {
        showAnswers(Role.RadioButton)
        focusSecondAnswer()

        compose.onRoot().performKeyInput { pressKey(Key.NumPadEnter) }
        compose.waitForIdle()

        assertEquals(1, mainPresses)
        assertEquals(emptyList<Int>(), picks)
    }

    @Test
    fun `Enter still reaches the screen once checking locks the answers`() {
        showAnswers(Role.RadioButton)
        focusSecondAnswer()

        compose.onRoot().performKeyInput { pressKey(Key.Enter) }
        compose.waitForIdle()
        compose.onRoot().performKeyInput { pressKey(Key.Enter) }
        compose.waitForIdle()

        assertEquals(2, mainPresses)
    }

    @Test
    fun `Enter picks an answer that keeps it, as a warm-up's guess does`() {
        showAnswers(Role.RadioButton, keepsEnter = true)
        focusSecondAnswer()

        compose.onRoot().performKeyInput { pressKey(Key.Enter) }
        compose.waitForIdle()

        assertEquals(listOf(1), picks)
        assertEquals(0, mainPresses)
    }

    private fun assertSpacePicks(role: Role) {
        showAnswers(role)
        focusSecondAnswer()

        compose.onRoot().performKeyInput { pressKey(Key.Spacebar) }
        compose.waitForIdle()
        assertEquals(listOf(1), picks)

        compose.onRoot().performKeyInput { pressKey(Key.Spacebar) }
        compose.waitForIdle()
        assertEquals(emptyList<Int>(), picks)
        assertEquals(0, mainPresses)
    }

    @Test
    fun `Space picks and unpicks a focused pick-one answer`() = assertSpacePicks(Role.RadioButton)

    @Test
    fun `Space ticks and unticks a focused pick-several answer`() = assertSpacePicks(Role.Checkbox)
}
