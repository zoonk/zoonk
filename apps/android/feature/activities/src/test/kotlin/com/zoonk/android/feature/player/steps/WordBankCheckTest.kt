package com.zoonk.android.feature.player.steps

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.pointer.PointerKeyboardModifiers
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.platform.WindowInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntSize
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** What a check adds to a word bank keeps what the learner did in it, and their focus, when the window crosses to wide. */
@RunWith(AndroidJUnit4::class)
class WordBankCheckTest {
    @get:Rule val rule = createComposeRule()

    @Test
    fun crossingToWideKeepsWhatTheLearnerDidInTheFeedback() {
        var width by mutableIntStateOf(PHONE)
        val window =
            object : WindowInfo {
                override val isWindowFocused = true
                override val keyboardModifiers = PointerKeyboardModifiers(0)
                override val containerSize get() = IntSize(width, HEIGHT)
            }

        rule.setContent {
            CompositionLocalProvider(
                LocalDensity provides Density(1f),
                LocalWindowInfo provides window,
                LocalWordBankCheck provides {
                    var dismissed by remember { mutableStateOf(false) }
                    if (!dismissed) TextButton(onClick = { dismissed = true }) { Text("Not now") }
                    TextButton(onClick = {}) { Text("Explain") }
                },
            ) {
                WordBankScene(question = { Text("Question") }, bank = { Text("Bank") })
            }
        }

        rule.onNodeWithText("Not now").performClick()
        rule.onNodeWithText("Explain").performSemanticsAction(SemanticsActions.RequestFocus)
        assertTrue(rule.onNodeWithText("Explain").getBoundsInRoot().bottom <= rule.onNodeWithText("Bank").getBoundsInRoot().top)

        width = WIDE
        rule.waitForIdle()

        assertTrue(rule.onNodeWithText("Explain").getBoundsInRoot().top >= rule.onNodeWithText("Bank").getBoundsInRoot().bottom)
        rule.onNodeWithText("Not now").assertDoesNotExist()
        rule.onNodeWithText("Explain").assertIsFocused()
    }
}

private const val PHONE = 411
private const val WIDE = 1280
private const val HEIGHT = 800
