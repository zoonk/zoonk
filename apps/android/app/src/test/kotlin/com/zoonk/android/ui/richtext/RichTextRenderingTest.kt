package com.zoonk.android.ui.richtext

import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performFirstLinkClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp")
class RichTextRenderingTest {
    @get:Rule
    val compose = createComposeRule()

    private val table =
        "| Linie | Durchschnittlicher Fahrpreis | Fahrgäste pro Tag | Pünktlichkeit |\n" +
            "| --- | ---: | ---: | :---: |\n| U1 | 2,80 € | 120000 | 94 % |"

    private fun horizontalRange() =
        compose
            .onNode(hasScrollAction() and SemanticsMatcher.keyIsDefined(SemanticsProperties.HorizontalScrollAxisRange))
            .fetchSemanticsNode()
            .config[SemanticsProperties.HorizontalScrollAxisRange]
            .maxValue()

    @Test
    fun readsMathInWordsWhileDrawingItTypeset() {
        compose.setContent { MaterialTheme { RichText("The area is \$\\pi r^2$, about \$\\frac{22}{7}$.") } }

        compose.onNodeWithContentDescription("The area is πr squared, about 22 over 7.").assertExists()
        compose.onNodeWithText("The area is πr2, about 22\u20447.").assertExists()
    }

    @Test
    fun drawsAFormulaFieldOnItsOwnAndReadsItInWords() {
        compose.setContent { MaterialTheme { MathText("v = \\sqrt{\\frac{GM}{r}}") } }

        compose.onNodeWithContentDescription("v = square root of GM over r").assertExists()
    }

    @Test
    fun scrollsAWideTableSidewaysOnAPhoneAndExposesItsRowsAndColumns() {
        compose.setContent { MaterialTheme { RichText(table, Modifier.width(320.dp)) } }

        assertTrue(horizontalRange() > 0f)

        val grid = compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.CollectionInfo)).fetchSemanticsNode()
        val info = grid.config[SemanticsProperties.CollectionInfo]
        assertEquals(2, info.rowCount)
        assertEquals(4, info.columnCount)

        val cell = compose.onNodeWithText("120,000", substring = true, useUnmergedTree = true).fetchSemanticsNode()
        val position = cell.config[SemanticsProperties.CollectionItemInfo]
        assertEquals(1, position.rowIndex)
        assertEquals(2, position.columnIndex)
    }

    @Test
    fun fitsANarrowTableWithoutScrolling() {
        compose.setContent { MaterialTheme { RichText("| Hora | Bicicletas |\n|---|---:|\n| 7h | 9 |") } }

        assertEquals(0f, horizontalRange())
    }

    @Test
    fun keepsWholeWordsAtTwiceTheFontSizeAndScrollsFurther() {
        RuntimeEnvironment.setFontScale(2f)
        compose.setContent { MaterialTheme { RichText(table, Modifier.width(320.dp)) } }

        val layout =
            compose
                .onNodeWithText("Durchschnittlicher Fahrpreis", useUnmergedTree = true)
                .fetchSemanticsNode()
                .let { node ->
                    val results = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
                    node.config[androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult].action?.invoke(results)
                    results.single()
                }

        // The column is at least as wide as its longest word, so a word never breaks inside.
        assertEquals(2, layout.lineCount)
        assertTrue(horizontalRange() > 0f)
    }

    @Test
    fun hidesBulletsFromTalkBackButKeepsNumbers() {
        compose.setContent { MaterialTheme { RichText("- One\n- Two\n\n1. First") } }

        compose.onAllNodesWithText("•").assertCountEquals(0)
        compose.onNodeWithText("1.", useUnmergedTree = true).assertExists()
    }

    @Test
    fun highlightsTheMarkedSentence() {
        compose.setContent {
            MaterialTheme {
                RichText("A change multiplies the **current** value. Then it repeats.", mark = "A change multiplies the **current** value.")
            }
        }

        val text =
            compose
                .onNodeWithText(
                    "Then it repeats",
                    substring = true,
                ).fetchSemanticsNode()
                .config[SemanticsProperties.Text]
                .single()
        val marked = text.spanStyles.filter { it.item.background.alpha > 0f }.map { text.text.substring(it.start, it.end) }

        assertEquals(listOf("A change multiplies the current value."), marked)
    }

    @Test
    fun opensCheckedLinksAndReadsUncheckedOnesAsWords() {
        val opened = mutableListOf<String>()
        val answer = "See [percent basics](https://www.zoonk.com/learn)."

        compose.setContent { MaterialTheme { MarkdownText(answer, onOpenLink = { opened += it }) } }
        compose.onNodeWithText("See percent basics.").performFirstLinkClick()

        assertEquals(listOf("https://www.zoonk.com/learn"), opened)
    }

    @Test
    fun readsAnUncheckedLinkAsItsWords() {
        compose.setContent { MaterialTheme { MarkdownText("See [percent basics](https://example.com).") } }

        val text =
            compose
                .onNodeWithText("See percent basics.")
                .fetchSemanticsNode()
                .config[SemanticsProperties.Text]
                .single()
        assertTrue(text.getLinkAnnotations(0, text.length).isEmpty())
    }
}
