package com.zoonk.android.ui.richtext

import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.BaselineShift
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private val ENGLISH =
    MathWords(
        squared = "squared",
        cubed = "cubed",
        power = { "to the power of $it" },
        subscript = { "sub $it" },
        fraction = { numerator, denominator -> "$numerator over $denominator" },
        root = { "square root of $it" },
    )

private const val GAP = "\u2005"

class LessonMathTest {
    private fun math(latex: String) = typesetMath(latex, ENGLISH)

    @Test
    fun setsOperatorsAndRelationsApartAndKeepsASignWithItsNumber() {
        assertEquals("0.75$GAP×${GAP}80$GAP=${GAP}60", math("0.75 \\times 80 = 60").text.text)
        assertEquals("x$GAP=$GAP\u22123", math("x = -3").text.text)
    }

    @Test
    fun italicizesVariablesButNotNumbersOrWords() {
        val text = math("2x + \\text{area}").text
        val italic = text.spanStyles.filter { it.item.fontStyle == FontStyle.Italic }.map { text.text.substring(it.start, it.end) }

        assertEquals(listOf("x"), italic)
    }

    @Test
    fun raisesExponentsAndLowersIndicesAndSaysThemInWords() {
        val squared = math("x^2")
        val raised = squared.text.spanStyles.single { it.item.baselineShift == BaselineShift.Superscript }

        assertEquals("x2", squared.text.text)
        assertEquals("2", squared.text.text.substring(raised.start, raised.end))
        assertEquals("x squared", squared.spoken)
        assertEquals("x sub 1 + y sub 1", math("x_1 + y_1").spoken)
        assertEquals("2 to the power of 10", math("2^{10}").spoken)
        assertEquals("90°", math("90^\\circ").spoken)
    }

    @Test
    fun setsFractionsWithASlashAndReadsThemAsOver() {
        val fraction = math("\\dfrac{30}{120} = \\dfrac{1}{4} = 25\\%")

        assertEquals("30\u2044120$GAP=${GAP}1\u20444$GAP=${GAP}25%", fraction.text.text)
        assertEquals("30 over 120 = 1 over 4 = 25%", fraction.spoken)
    }

    @Test
    fun readsRootsUnitsAndSymbolsFromTheSeededLessons() {
        assertEquals("v$GAP=$GAP√(GM\u2044r)", math("v = \\sqrt{\\frac{GM}{r}}").text.text)
        assertEquals("v = square root of GM over r", math("v = \\sqrt{\\frac{GM}{r}}").spoken)
        assertEquals("λ$GAP=${GAP}1240\u20441,89", math("\\lambda = \\dfrac{1240}{1{,}89}").text.text)
        assertEquals("λ (nm) = 1240 over E (eV)", math("\\lambda\\ (\\text{nm}) = \\dfrac{1240}{E\\ (\\text{eV})}").spoken)
    }

    @Test
    fun acceptsOverEscapedCommandsAsMainDoes() {
        assertEquals(math("a \\rightarrow b").text.text, math("a \\\\rightarrow b").text.text)
    }

    @Test
    fun keepsUnknownCommandsReadable() {
        assertTrue(math("\\unknown{x}").text.text.startsWith("unknown"))
    }
}
