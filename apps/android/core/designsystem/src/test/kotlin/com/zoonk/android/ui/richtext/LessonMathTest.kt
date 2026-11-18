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
        cubeRoot = { "cube root of $it" },
        nthRoot = { index, radicand -> "${index}th root of $radicand" },
        bar = { "$it bar" },
        dot = { "$it dot" },
        hat = { "$it hat" },
        tilde = { "$it tilde" },
        vector = { "vector $it" },
    )

private const val GAP = "\u2005"

class LessonMathTest {
    private fun math(latex: String) = typesetMath(latex, ENGLISH)

    @Test fun aRootKeepsItsEntireFractionAsOneDrawing() {
        val formula = math("\\sqrt{\\frac{GM}{r}}")
        val root = formula.text.getStringAnnotations("math-root", 0, formula.text.length).single()
        assertEquals("√GM⁄r", formula.text.text.substring(root.start, root.end))
    }

    @Test fun punctuationAfterDisplayMathStaysWithTheFormula() {
        val parts =
            splitAtDisplayMath(listOf(RichSegment(SegmentKind.DisplayMath, "x = 1"), RichSegment(SegmentKind.Text, ", then continue.")))
        assertEquals("x = 1\\text{,}", parts.first().single().text)
        assertEquals("then continue.", parts.last().single().text)
    }

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
    fun setsALongFractionAtFullSizeSoItsExponentsStayRaised() {
        val formula = math("\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}")

        assertEquals("(\u2212b$GAP±$GAP√b2$GAP\u2212${GAP}4ac)/(2a)", formula.text.text)

        fun shifted(at: Int) = formula.text.spanStyles.any { it.start <= at && at < it.end && it.item.baselineShift != null }
        val square = formula.text.text.indexOf("b2")
        assertTrue("b sits on the line and its 2 above it", !shifted(square) && shifted(square + 1))
    }

    /** As KaTeX sets the fraction as the script's base, a power after it raises the whole quotient. */
    @Test
    fun aScriptAfterAFractionRaisesTheWholeQuotient() {
        val formula = math("\\frac{x+1}{2}^2")

        assertEquals("((x$GAP+${GAP}1)/2)2", formula.text.text)

        fun shifted(at: Int) = formula.text.spanStyles.any { it.start <= at && at < it.end && it.item.baselineShift != null }
        val last = formula.text.text.lastIndex
        assertTrue("the bracket closes on the line and the 2 sits above it", !shifted(last - 1) && shifted(last))
        assertEquals("(1\u2044" + "4)2", math("\\frac{1}{4}^2").text.text)
    }

    /** In an exponent the fraction is grouped against the exponent's own line, so its sum keeps its brackets. */
    @Test
    fun aSumInAFractionInsideAnExponentKeepsItsBrackets() {
        assertEquals("e(x+1)/2", math("e^{\\frac{x+1}{2}}").text.text)
        assertEquals("e2/(n+1)", math("e^{\\frac{2}{n+1}}").text.text)
    }

    @Test
    fun groupsOnlyTheSumsAndProductsOfALongFraction() {
        assertEquals("distance/time", math("\\frac{\\text{distance}}{\\text{time}}").text.text)
        assertEquals("12000/60", math("\\frac{12000}{60}").text.text)
        assertEquals("12 000/60", math("\\frac{12\\,000}{60}").text.text)
    }

    @Test
    fun keepsAProductsBracketsAndLeavesASinglePowerOrSubscriptBare() {
        assertEquals("8.314/(RT)", math("\\frac{8.314}{RT}").text.text)
        assertEquals("12000/r2", math("\\frac{12000}{r^2}").text.text)
        assertEquals("12000/v0", math("\\frac{12000}{v_0}").text.text)
    }

    @Test
    fun keepsTheBracketsOfSymbolsOrWordsSideBySide() {
        assertEquals("1/(μ0ε0)", math("\\frac{1}{\\mu_0 \\varepsilon_0}").text.text)
        assertEquals("12000/(Δx)", math("\\frac{12000}{\\Delta x}").text.text)
        assertEquals("12000/μ0", math("\\frac{12000}{\\mu_0}").text.text)
        assertEquals("(mass volume)/12000", math("\\frac{\\text{mass}\\,\\text{volume}}{12000}").text.text)
        assertEquals("(mass volume)/12000", math("\\frac{\\text{mass volume}}{12000}").text.text)
        assertEquals("(total distance)/(total time)", math("\\frac{\\text{total distance}}{\\text{total time}}").text.text)
    }

    @Test
    fun readsRootsUnitsAndSymbolsFromTheSeededLessons() {
        assertEquals("v$GAP=$GAP√GM\u2044r", math("v = \\sqrt{\\frac{GM}{r}}").text.text)
        assertEquals("v = square root of GM over r", math("v = \\sqrt{\\frac{GM}{r}}").spoken)
        assertEquals("λ$GAP=${GAP}1240\u20441,89", math("\\lambda = \\dfrac{1240}{1{,}89}").text.text)
        assertEquals("λ (nm) = 1240 over E (eV)", math("\\lambda\\ (\\text{nm}) = \\dfrac{1240}{E\\ (\\text{eV})}").spoken)
    }

    @Test
    fun readsAScriptWrittenWithASpaceAfterItsMark() {
        assertEquals("x squared + a sub 1", math("x^ 2 + a_ {1}").spoken)
        assertEquals("x squared", math("x^\t2").spoken)
    }

    @Test
    fun namesARootByItsIndexAndSetsTheIndexRaised() {
        val cubeRoot = math("\\sqrt[3]{8}")
        val raised = cubeRoot.text.spanStyles.single { it.item.baselineShift == BaselineShift.Superscript }

        assertEquals("3√8", cubeRoot.text.text)
        assertEquals("3", cubeRoot.text.text.substring(raised.start, raised.end))
        assertEquals("cube root of 8", cubeRoot.spoken)
        assertEquals("4th root of 16", math("\\sqrt[4]{16}").spoken)
        assertEquals("square root of 9", math("\\sqrt[2]{9}").spoken)
        assertEquals("cube root of 8", math("\\sqrt\t[3]{8}").spoken)
    }

    @Test
    fun saysTheAccentThatChangesWhatALetterMeans() {
        assertEquals("x bar", math("\\bar{x}").spoken)
        assertEquals("vector v = x dot", math("\\vec{v} = \\dot{x}").spoken)
        assertEquals("p hat", math("\\hat{p}").spoken)
    }

    @Test
    fun readsAFunctionAppliedToABracedArgumentApart() {
        assertEquals("sin x + cos(x)", math("\\sin{x} + \\cos(x)").spoken)
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
