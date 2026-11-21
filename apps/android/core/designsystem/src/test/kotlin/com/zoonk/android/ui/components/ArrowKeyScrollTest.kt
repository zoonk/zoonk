package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.richtext.MarkdownText
import com.zoonk.android.ui.richtext.MathText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Wide content scrolls with a keyboard too (#2169): Tab reaches it and the arrow keys move it. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w700dp-h900dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@OptIn(ExperimentalTestApi::class)
class ArrowKeyScrollTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val longCode =
        "const total = items.filter((item) => item.active).map((item) => item.price * item.quantity).reduce((a, b) => a + b, 0);"

    private fun assertScrollsByKeys(content: @Composable () -> Unit) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    Column(Modifier.padding(16.dp)) {
                        Box(Modifier.size(48.dp).focusable())
                        content()
                    }
                }
            }
        }
        val scroller = compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.HorizontalScrollAxisRange))

        compose.onRoot().performKeyInput {
            pressKey(Key.Tab)
            pressKey(Key.Tab)
        }
        scroller.assertIsFocused()
        compose.onRoot().performKeyInput { repeat(2) { pressKey(Key.DirectionRight) } }
        compose.waitForIdle()

        assertTrue(scroller.fetchSemanticsNode().config[SemanticsProperties.HorizontalScrollAxisRange].value() > 0f)
    }

    @Test
    fun `a lesson's code block`() = assertScrollsByKeys { RichText("Run it:\n```js\n$longCode\n```") }

    @Test
    fun `a buddy answer's code block`() = assertScrollsByKeys { MarkdownText("Here it is:\n\n```js\n$longCode\n```\n", onOpenLink = {}) }

    @Test
    fun `a formula`() = assertScrollsByKeys { MathText((1..40).joinToString(" + ") { "a_{$it}" }) }
}
