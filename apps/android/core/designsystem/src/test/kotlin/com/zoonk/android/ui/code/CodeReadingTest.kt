package com.zoonk.android.ui.code

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** TalkBack keeps code's lines and their indentation apart, as main's screen readers do. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w390dp-h800dp-mdpi")
class CodeReadingTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private fun show(content: @Composable () -> Unit) {
        compose.setContent { ZoonkTheme { Surface { Column { content() } } } }
    }

    @Test
    fun `reads a line's indentation apart from its code`() {
        assertEquals(SpokenCodeLine("print(fruta)", listOf(IndentRun(4, tab = false))), readCodeLine("    print(fruta)"))
        assertEquals(listOf(IndentRun(2, tab = true), IndentRun(2, tab = false)), readCodeLine("\t\t  return n").indent)
        assertEquals(SpokenCodeLine("", emptyList()), readCodeLine("   "))
    }

    @Test
    fun `an indented option and an unindented one read apart`() {
        show {
            CodeSnippet("for fruta in frutas:\n    print(fruta)", "python", Modifier.testTag("inside"))
            CodeSnippet("for fruta in frutas:\nprint(fruta)", "python", Modifier.testTag("outside"))
            CodeSnippet("print(frutas)", "python", Modifier.testTag("one"))
        }

        assertEquals("Line 1: for fruta in frutas: Line 2, indented 4 spaces: print(fruta)", textOf("inside"))
        assertEquals("Line 1: for fruta in frutas: Line 2: print(fruta)", textOf("outside"))
        assertEquals("print(frutas)", textOf("one"))
    }

    @Test
    fun `a lesson's code block reads each line with its number and indentation`() {
        show { RichText("Run it:\n```python\nfrutas = ['maçã']\n\n\tprint(frutas)\n```") }

        compose.onNodeWithText("Line 1: frutas = ['maçã']", substring = true).assertExists()
        compose.onNodeWithText("Line 2: blank", substring = true).assertExists()
        compose.onNodeWithText("Line 3, indented 1 tab: print(frutas)", substring = true).assertExists()
    }

    @Test
    fun `a code option's tag sits beside its last line when there's room`() {
        show {
            AnswerOption(
                marker = 1,
                picked = true,
                result = null,
                onClick = {},
                modifier = Modifier.testTag("option"),
                tag = { Text("Your answer", Modifier.testTag("tag")) },
            ) {
                CodeSnippet("8\n12", null, Modifier.testTag("code"))
            }
        }

        val option = compose.onNodeWithTag("option", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val code = compose.onNodeWithTag("code", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val tag = compose.onNodeWithTag("tag", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot

        assertTrue("the tag is beside the code, not under it", tag.top < code.bottom && tag.bottom > code.bottom - code.height / 2)
        assertTrue("the option keeps no row for the tag", option.bottom - code.bottom < tag.height * 2)
    }

    private fun textOf(tag: String): String =
        compose
            .onNodeWithTag(tag, useUnmergedTree = true)
            .fetchSemanticsNode()
            .config[SemanticsProperties.Text]
            .joinToString(" ") { it.text }
}
