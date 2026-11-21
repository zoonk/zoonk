package com.zoonk.android.ui.code

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class CodeLinesTest {
    private val colors = CodeColors(Color.Red, Color.Green, Color.Blue, Color.Gray)

    private fun shown(
        code: String,
        language: String?,
        field: Boolean = false,
    ) = styledCodeLine(highlightCode(code, language).first(), colors, field).text.replace('\u200B', '|')

    @Test
    fun `splits a wrapped line before a dot and after an opening bracket or a comma, never inside a string or a pair`() {
        assertEquals(
            "Promise|.resolve(|'a.b')|.then(|console|.log,| f())",
            shown("Promise.resolve('a.b').then(console.log, f())", "javascript"),
        )
        assertEquals("print(|\"x, y\")", shown("print(\"x, y\")", "python"))
    }

    @Test
    fun `keeps a field's text as typed, so its cursor maps one to one`() {
        assertEquals("a.b(c)\tx", shown("a.b(c)\tx", "javascript", field = true))
    }

    @Test
    fun `sets tabs to four columns and counts them in a line's indentation`() {
        assertEquals("    x = 1", shown("\tx =\t1", "python"))
        assertEquals("a   b", shown("a\tb", "python"))
        assertEquals(6, indentOf(highlightCode("\t  if x:", "python").first()))
    }
}
