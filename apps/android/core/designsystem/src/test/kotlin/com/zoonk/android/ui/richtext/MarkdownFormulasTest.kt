package com.zoonk.android.ui.richtext

import org.commonmark.node.IndentedCodeBlock
import org.junit.Assert.assertEquals
import org.junit.Test

/** Tutor answers read math between `$$` only (main's Streamdown math plugin), never inside code. */
class MarkdownFormulasTest {
    @Test
    fun takesOutDisplayFormulasSoMarkdownNeverReadsTheirMarks() {
        val (text, formulas) = takeOutFormulas("Pay $$\\frac{a_1 * b_1}{2}$$ now, not \$5 or \$10.")

        assertEquals(
            listOf(MarkdownFormula(display = false, latex = "\\frac{a_1 * b_1}{2}", source = "\$\$\\frac{a_1 * b_1}{2}\$\$")),
            formulas,
        )
        assertEquals("Pay \uE0000\uE001 now, not \$5 or \$10.", text)
    }

    @Test
    fun readsAFormulaAcrossLines() {
        val (_, formulas) = takeOutFormulas("$$\nv = \\sqrt{\\frac{GM}{r}}\n$$")

        assertEquals(listOf(true to "v = \\sqrt{\\frac{GM}{r}}"), formulas.map { it.display to it.latex })
    }

    @Test
    fun leavesDollarsInCodeAndEscapedDollarsAlone() {
        val markdown = "Run `echo \$\$HOME\$\$` and:\n\n```sh\necho \$\$ \$\$\n```\n\nThen \\\$\$x\$\$ stays."
        val (text, formulas) = takeOutFormulas(markdown)

        assertEquals(emptyList<MarkdownFormula>(), formulas)
        assertEquals(markdown, text)
    }

    @Test
    fun showsAFormulaMarkdownReadsAsCodeAsWritten() {
        val code = parseMarkdown("Some code:\n\n    \$\$x^2\$\$").root.lastChild as IndentedCodeBlock

        assertEquals("\$\$x^2\$\$\n", code.literal)
    }
}
