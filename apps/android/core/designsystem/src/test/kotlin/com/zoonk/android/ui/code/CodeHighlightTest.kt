package com.zoonk.android.ui.code

import org.junit.Assert.assertEquals
import org.junit.Test

// The cases of main's `highlight-code.test.ts`, which this highlighter must match token for token.
class CodeHighlightTest {
    private fun colored(line: List<CodeToken>?): List<Pair<CodeTokenKind, String>> =
        line.orEmpty().filter { it.kind != CodeTokenKind.Plain }.map { it.kind to it.text }

    private fun coloredLine(
        code: String,
        language: String?,
    ) = colored(highlightCode(code, language).first())

    private fun builtin(text: String) = CodeTokenKind.Builtin to text

    private fun comment(text: String) = CodeTokenKind.Comment to text

    private fun keyword(text: String) = CodeTokenKind.Keyword to text

    private fun number(text: String) = CodeTokenKind.Number to text

    private fun string(text: String) = CodeTokenKind.String to text

    @Test
    fun `colors Python keywords, built-ins, numbers and comments`() {
        assertEquals(
            listOf(keyword("for"), keyword("in"), builtin("range"), number("1"), number("100"), comment("# count")),
            coloredLine("for n in range(1, 100):  # count", "python"),
        )
    }

    @Test
    fun `keeps the text of every line exactly, including indentation`() {
        val code = "total = 0\nfor n in range(3):\n    total += n\n\tprint(total)  "

        assertEquals(code.split("\n"), highlightCode(code, "python").map(::codeLineText))
    }

    @Test
    fun `keeps empty lines and carriage returns`() {
        assertEquals(3, highlightCode("a = 1\n\nb = 2", "python").size)
        assertEquals(listOf("a\r", "b"), highlightCode("a\r\nb", "python").map(::codeLineText))
        assertEquals(listOf(emptyList<CodeToken>()), highlightCode("", "javascript"))
    }

    @Test
    fun `colors a string spanning lines on each line`() {
        val lines = highlightCode("s = \"\"\"one\ntwo\"\"\"", "python")

        assertEquals(listOf(string("\"\"\"one")), colored(lines[0]))
        assertEquals(listOf(string("two\"\"\"")), colored(lines[1]))
    }

    @Test
    fun `colors JavaScript strings and template literals, and leaves identifiers plain`() {
        assertEquals(
            listOf(keyword("const"), builtin("Math"), string("`lo`"), string("'x'")),
            coloredLine("const mid = Math.floor(`lo` + 'x');", "javascript"),
        )
    }

    @Test
    fun `leaves a name after a dot plain, since it's a property`() {
        assertEquals(listOf(builtin("console")), coloredLine("console.log(event.type, list.delete)", "ts"))
    }

    @Test
    fun `reads SQL keywords in any case`() {
        assertEquals(
            listOf(keyword("select"), keyword("FROM"), keyword("where"), number("200"), comment("-- big")),
            coloredLine("select name FROM countries where pop > 200 -- big", "sql"),
        )
    }

    @Test
    fun `colors an unfinished string to the end of the line while the learner types`() {
        assertEquals(string("'Asi"), coloredLine("WHERE continent = 'Asi", "sql").last())
    }

    @Test
    fun `reads the names writers give a fence, in any case`() {
        val python = coloredLine("def f(): return None", "python")

        assertEquals(python, coloredLine("def f(): return None", "py"))
        assertEquals(python, coloredLine("def f(): return None", "Python3"))
        assertEquals(coloredLine("let x = 1", "javascript"), coloredLine("let x = 1", "JS"))
    }

    @Test
    fun `colors TypeScript's own keywords and types, which JavaScript leaves plain`() {
        val code = "type Id = string; interface User { id: Id }"

        assertEquals(listOf(keyword("type"), builtin("string"), keyword("interface")), coloredLine(code, "typescript"))
        assertEquals(emptyList<Pair<CodeTokenKind, String>>(), coloredLine(code, "javascript"))
    }

    @Test
    fun `colors Java and C, with C's preprocessor lines`() {
        assertEquals(
            listOf(keyword("public"), keyword("static"), keyword("void"), builtin("String"), keyword("int"), number("2")),
            coloredLine("public static void main(String[] args) { int n = 2; }", "java"),
        )
        assertEquals(listOf(keyword("#include")), coloredLine("#include <stdio.h>", "c"))
        assertEquals(
            listOf(builtin("printf"), string("\"%d\\n\""), comment("// print")),
            coloredLine("printf(\"%d\\n\", x); // print", "cpp"),
        )
    }

    @Test
    fun `colors HTML's tags and attribute values, never an apostrophe in its text`() {
        assertEquals(
            listOf(keyword("a"), string("\"/home\""), keyword("a"), comment("<!-- nav -->")),
            coloredLine("<a href=\"/home\">It's here</a> <!-- nav -->", "html"),
        )
    }

    @Test
    fun `colors CSS's at-rules, numbers with units and comments`() {
        assertEquals(
            listOf(keyword("@media"), number("40rem"), number("-4px"), number("50%"), comment("/* wide */")),
            coloredLine("@media (width > 40rem) { margin: -4px 50%; } /* wide */", "css"),
        )
    }

    @Test
    fun `colors nothing in program output`() {
        assertEquals(emptyList<Pair<CodeTokenKind, String>>(), coloredLine("It's 42 # not a comment", "text"))
        assertEquals(emptyList<Pair<CodeTokenKind, String>>(), coloredLine("Total: 3 // done", "output"))
    }

    @Test
    fun `colors only strings, numbers and comments in a language it doesn't know`() {
        assertEquals(
            listOf(string("\"oi\""), comment("// 2 items")),
            coloredLine("fn main() { let s = \"oi\"; } // 2 items", "rust"),
        )
        assertEquals(listOf(number("1"), number("2"), comment("# loop")), coloredLine("for x in [1, 2]:  # loop", null))
        assertEquals(listOf(number("1"), comment("-- one")), coloredLine("SELECT 1 -- one", null))
    }

    @Test
    fun `doesn't take a URL, a directive, a decrement or an apostrophe for a comment or a string`() {
        val none = emptyList<Pair<CodeTokenKind, String>>()

        assertEquals(none, coloredLine("curl https://zoonk.com/api", "bash"))
        assertEquals(none, coloredLine("#include <math.h>", "objective-c"))
        assertEquals(none, coloredLine("i--;", null))
        assertEquals(none, coloredLine("Don't stop, it's fine", null))
    }

    // Android's ICU engine and the JVM read `\s`, `\d`, `\w` and `.` differently from JavaScript, so the patterns
    // spell JavaScript's meaning out; these pin the cases where the engines disagree.
    @Test
    fun `reads Unicode letters and spaces as JavaScript does`() {
        assertEquals(
            listOf(CodeToken(CodeTokenKind.Plain, "café = "), CodeToken(CodeTokenKind.String, "'naïve'")),
            highlightCode("café = 'naïve'", "python").first(),
        )
        assertEquals(
            listOf(string("\"a\""), comment("-- b")),
            coloredLine("\"a\"\u00A0-- b", null),
        )
        assertEquals(listOf(number("12")), coloredLine("x = 12\u0663", "python"))
    }
}
