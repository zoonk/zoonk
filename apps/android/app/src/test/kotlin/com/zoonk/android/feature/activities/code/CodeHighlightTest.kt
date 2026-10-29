package com.zoonk.android.feature.activities.code

import org.junit.Assert.assertEquals
import org.junit.Test

// Expected tokens are what main's `highlight-code.ts` returns for the same code.
class CodeHighlightTest {
    private fun builtin(text: String) = CodeToken(CodeTokenKind.Builtin, text)

    private fun comment(text: String) = CodeToken(CodeTokenKind.Comment, text)

    private fun keyword(text: String) = CodeToken(CodeTokenKind.Keyword, text)

    private fun number(text: String) = CodeToken(CodeTokenKind.Number, text)

    private fun plain(text: String) = CodeToken(CodeTokenKind.Plain, text)

    private fun string(text: String) = CodeToken(CodeTokenKind.String, text)

    @Test
    fun `colors Python keywords, built-ins, numbers, strings and comments`() {
        assertEquals(
            listOf(
                listOf(
                    keyword("for"),
                    plain(" "),
                    plain("n"),
                    plain(" "),
                    keyword("in"),
                    plain(" "),
                    builtin("range"),
                    plain("("),
                    number("1"),
                    plain(","),
                    plain(" "),
                    number("100"),
                    plain("):"),
                    plain("  "),
                    comment("# count"),
                ),
            ),
            highlightCode("for n in range(1, 100):  # count", CodeLanguage.Python),
        )
        assertEquals(
            listOf(
                listOf(
                    plain("x"),
                    plain(" "),
                    plain("="),
                    plain(" "),
                    string("rb'\\x00'"),
                    plain(" "),
                    plain("+"),
                    plain(" "),
                    string("f\"{n!r}\""),
                    plain(" "),
                    plain("+"),
                    plain(" "),
                    string("F'a'"),
                ),
            ),
            highlightCode("x = rb'\\x00' + f\"{n!r}\" + F'a'", CodeLanguage.Python),
        )
        assertEquals(
            listOf(
                listOf(keyword("def"), plain(" "), plain("f"), plain("("), plain("a"), plain("):")),
                listOf(plain("\t"), keyword("return"), plain(" "), plain("a"), plain(" "), plain("**"), plain(" "), number("2.5e-3")),
                emptyList<CodeToken>(),
                listOf(
                    builtin("print"),
                    plain("("),
                    plain("f"),
                    plain("("),
                    number("0x1F"),
                    plain("),"),
                    plain(" "),
                    keyword("None"),
                    plain(")"),
                ),
            ),
            highlightCode("def f(a):\n\treturn a ** 2.5e-3\n\nprint(f(0x1F), None)", CodeLanguage.Python),
        )
    }

    @Test
    fun `colors a string or comment that spans lines on each line, even unclosed`() {
        assertEquals(
            listOf(
                listOf(plain("s"), plain(" "), plain("="), plain(" "), string("\"\"\"one")),
                listOf(string("two\"\"\"")),
            ),
            highlightCode("s = \"\"\"one\ntwo\"\"\"", CodeLanguage.Python),
        )
        assertEquals(
            listOf(
                listOf(plain("t"), plain(" "), plain("="), plain(" "), string("'''never closed")),
                listOf(string("still string")),
            ),
            highlightCode("t = '''never closed\nstill string", CodeLanguage.Python),
        )
        assertEquals(
            listOf(
                listOf(
                    keyword("let"),
                    plain(" "),
                    plain("\$a_1"),
                    plain(" "),
                    plain("="),
                    plain(" "),
                    number("3"),
                    plain(" "),
                    plain("/"),
                    plain(" "),
                    number("2"),
                    plain(";"),
                    plain(" "),
                    comment("// half"),
                ),
                listOf(comment("/* multi")),
                listOf(
                    comment("line */"),
                    plain(" "),
                    builtin("console"),
                    plain("."),
                    plain("log"),
                    plain("("),
                    plain("\$a_1"),
                    plain(")"),
                ),
            ),
            highlightCode("let \$a_1 = 3 / 2; // half\n/* multi\nline */ console.log(\$a_1)", CodeLanguage.JavaScript),
        )
        assertEquals(
            listOf(
                listOf(keyword("const"), plain(" "), plain("s"), plain(" "), plain("="), plain(" "), string("`a")),
                listOf(string("\${b}")),
                listOf(string("c`"), plain(";"), plain(" "), comment("/* open")),
            ),
            highlightCode("const s = `a\n\${b}\nc`; /* open", CodeLanguage.JavaScript),
        )
    }

    @Test
    fun `colors JavaScript strings and leaves identifiers and operators plain`() {
        assertEquals(
            listOf(
                listOf(
                    keyword("const"),
                    plain(" "),
                    plain("mid"),
                    plain(" "),
                    plain("="),
                    plain(" "),
                    builtin("Math"),
                    plain("."),
                    plain("floor"),
                    plain("("),
                    string("`lo`"),
                    plain(" "),
                    plain("+"),
                    plain(" "),
                    string("'x'"),
                    plain(");"),
                ),
            ),
            highlightCode("const mid = Math.floor(`lo` + 'x');", CodeLanguage.JavaScript),
        )
        assertEquals(
            listOf(
                listOf(
                    keyword("if"),
                    plain(" "),
                    plain("("),
                    plain("a"),
                    plain(" "),
                    plain(">="),
                    plain(" "),
                    number("1"),
                    plain(" "),
                    plain("&&"),
                    plain(" "),
                    plain("b"),
                    plain(" "),
                    plain("!=="),
                    plain(" "),
                    string("'\\''"),
                    plain(")"),
                    plain(" "),
                    plain("{"),
                    plain(" "),
                    keyword("return"),
                    plain(" "),
                    plain("-"),
                    number("1e5"),
                    plain(" "),
                    plain("}"),
                ),
            ),
            highlightCode("if (a >= 1 && b !== '\\'') { return -1e5 }", CodeLanguage.JavaScript),
        )
    }

    @Test
    fun `reads SQL keywords in any case and doubled quotes inside strings`() {
        assertEquals(
            listOf(
                listOf(
                    keyword("select"),
                    plain(" "),
                    plain("name"),
                    plain(" "),
                    keyword("FROM"),
                    plain(" "),
                    plain("countries"),
                    plain(" "),
                    keyword("where"),
                    plain(" "),
                    plain("pop"),
                    plain(" "),
                    plain(">"),
                    plain(" "),
                    number("200"),
                    plain(" "),
                    comment("-- big"),
                ),
            ),
            highlightCode("select name FROM countries where pop > 200 -- big", CodeLanguage.Sql),
        )
        assertEquals(
            listOf(
                listOf(
                    keyword("SELECT"),
                    plain(" "),
                    builtin("COUNT"),
                    plain("(*)"),
                    plain(" "),
                    keyword("AS"),
                    plain(" "),
                    plain("n"),
                    plain(","),
                    plain(" "),
                    string("'it''s'"),
                    plain(" "),
                    keyword("FROM"),
                    plain(" "),
                    plain("t"),
                    plain(" "),
                    comment("/* note */"),
                ),
                listOf(keyword("GROUP"), plain(" "), keyword("BY"), plain(" "), plain("Region"), plain("\r")),
                listOf(keyword("ORDER"), plain(" "), keyword("BY"), plain(" "), plain("n"), plain(" "), keyword("DESC"), plain(";")),
            ),
            highlightCode("SELECT COUNT(*) AS n, 'it''s' FROM t /* note */\nGROUP BY Region\r\nORDER BY n DESC;", CodeLanguage.Sql),
        )
    }

    @Test
    fun `splits words at letters JavaScript's word class doesn't cover and treats Unicode spaces as spaces`() {
        assertEquals(
            listOf(
                listOf(
                    plain("caf"),
                    plain("\u00E9"),
                    plain(" "),
                    plain("="),
                    plain(" "),
                    string("'na\u00EFve'"),
                    plain(" "),
                    comment("# ok\u00A0end \uD83D\uDE42x"),
                ),
            ),
            highlightCode("caf\u00E9 = 'na\u00EFve' # ok\u00A0end \uD83D\uDE42x", CodeLanguage.Python),
        )
        assertEquals(
            listOf(
                listOf(
                    keyword("const"),
                    plain(" "),
                    plain("u"),
                    plain(" "),
                    plain("="),
                    plain(" "),
                    string("\"emoji \uD83D\uDE42\""),
                    plain("\u2028"),
                    plain("next"),
                ),
            ),
            highlightCode("const u = \"emoji \uD83D\uDE42\"\u2028next", CodeLanguage.JavaScript),
        )
    }

    @Test
    fun `keeps carriage returns and empty lines`() {
        assertEquals(
            listOf(
                listOf(plain("a"), plain("\r")),
                listOf(plain("b")),
            ),
            highlightCode("a\r\nb", CodeLanguage.Python),
        )
        assertEquals(
            listOf(
                emptyList<CodeToken>(),
            ),
            highlightCode("", CodeLanguage.JavaScript),
        )
        assertEquals(
            listOf(
                emptyList<CodeToken>(),
                emptyList<CodeToken>(),
                emptyList<CodeToken>(),
            ),
            highlightCode("\n\n", CodeLanguage.Sql),
        )
    }
}
