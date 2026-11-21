package com.zoonk.android.ui.richtext

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The cases of main's `code-fence.test.ts`.
class CodeFenceTest {
    private val text =
        listOf(
            "O que aparece no console?",
            "```JavaScript linhas",
            "if (pronto) {",
            "  console.log('fim');",
            "}",
            "```",
            "Escolha uma opção.",
        )

    @Test
    fun `reads a fence's language and its code exactly as written`() {
        assertEquals(
            CodeFence("if (pronto) {\n  console.log('fim');\n}", "javascript", start = 1, end = 6, closed = true),
            readCodeFence(text, 1),
        )
    }

    @Test
    fun `runs a fence that never closes to the end, as CommonMark does`() {
        assertEquals(
            CodeFence("x = 1\n\ny = 2", null, start = 0, end = 4, closed = false),
            readCodeFence(listOf("```", "x = 1", "", "y = 2"), 0),
        )
    }

    @Test
    fun `closes only on a fence at least as long as the opening one`() {
        assertEquals("```\ntexto", readCodeFence(listOf("````md", "```", "texto", "````"), 0)?.code)
    }

    @Test
    fun `reads a fence of tildes, which only tildes close, as CommonMark does`() {
        assertEquals(
            CodeFence("f(`a`);\n```", "js", start = 0, end = 4, closed = true),
            readCodeFence(listOf("~~~js `x`", "f(`a`);", "```", "~~~~"), 0),
        )
        assertEquals(false, readCodeFence(listOf("```", "x", "~~~"), 0)?.closed)
        assertNull(readCodeFence(listOf("~~", "x", "~~"), 0))
    }

    @Test
    fun `takes the opening fence's indentation off its code, as CommonMark does`() {
        assertEquals("if x:\n    y()\nz", readCodeFence(listOf("  ```py", "  if x:", "      y()", " z", "  ```"), 0)?.code)
    }

    @Test
    fun `reads inline code and an indented block as no fence`() {
        assertNull(readCodeFence(listOf("```x``` e mais"), 0))
        assertNull(readCodeFence(listOf("    ```", "x", "```"), 0))
        assertNull(readCodeFence(text, 2))
    }

    @Test
    fun `marks every line of each block, its fences included`() {
        assertEquals(setOf(1, 2, 3, 4, 5, 7, 8, 9), findCodeFenceLines(text + listOf("```sql", "SELECT 1;", "```")))
    }

    @Test
    fun `reads a text that is one closed block and nothing else`() {
        assertEquals("f();", readWholeCodeFence(" ```js\nf();\n```\n")?.code)
        assertNull(readWholeCodeFence("Rode:\n```js\nf();\n```"))
        assertNull(readWholeCodeFence("```js\nf();\n```\nE depois?"))
        assertNull(readWholeCodeFence("```js\nf();"))
    }

    @Test
    fun `never starts a table inside code`() {
        assertEquals(emptySet<Int>(), findMarkdownTableLines(listOf("```", "| a | b |", "|---|---|", "```")))
    }
}
