package com.zoonk.android.feature.questions

import com.zoonk.android.ui.richtext.RichSegment
import com.zoonk.android.ui.richtext.SegmentKind
import com.zoonk.api.ApiJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QuestionModelsTest {
    @Test
    fun answersKeepTheApisShape() {
        val answers =
            mapOf(
                Answer.Choice(2) to """{"selectedIndex":2}""",
                Answer.Choices(listOf(0, 3)) to """{"selectedIndexes":[0,3]}""",
                Answer.TrueFalse(false) to """{"isTrue":false}""",
                Answer.Matches(listOf(1, 0)) to """{"matches":[1,0]}""",
                Answer.Matches(listOf(1, 0), listOf(MatchTry(0, 0))) to """{"matches":[1,0],"misses":[{"left":0,"right":0}]}""",
                Answer.Numeric(2.5) to """{"number":2.5}""",
                Answer.Order(listOf(2, 0, 1)) to """{"order":[2,0,1]}""",
                Answer.Text("Na") to """{"text":"Na"}""",
                Answer.DontKnow to """{"dontKnow":true}""",
            )

        answers.forEach { (answer, json) ->
            assertEquals(json, ApiJson.encodeToString(Answer.serializer(), answer))
            assertEquals(answer, ApiJson.decodeFromString(Answer.serializer(), json))
        }
    }

    @Test
    fun itemTextKeepsTablesAndMoney() {
        val blocks = parseItemText("Costs $5 and $10.\nIt's **cheap**.\n\n| Item | Price |\n| --- | ---: |\n| Shirt | R$ 80 |")

        assertEquals(2, blocks.size)
        val paragraph = blocks[0] as ItemBlock.Paragraph
        assertEquals("Costs $5 and $10.\nIt's cheap.", paragraph.segments.joinToString("") { it.text })
        assertTrue(paragraph.segments.any { it.kind == SegmentKind.Bold && it.text == "cheap" })
        val table = blocks[1] as ItemBlock.Table
        assertEquals("R$ 80", table.rows[0][1][0].text)
    }

    @Test
    fun itemTextReadsItalicsThatOpenOnOneLineAndCloseOnALaterOne() {
        val paragraph = parseItemText("_Na rádio,\nse fala._").single() as ItemBlock.Paragraph

        assertEquals(listOf(RichSegment(SegmentKind.Italic, "Na rádio,\nse fala.")), paragraph.segments)
    }

    @Test
    fun anOptionIsOneLineWithItsMathAndMoney() {
        assertEquals(
            listOf(
                RichSegment(SegmentKind.Text, "The "),
                RichSegment(SegmentKind.Bold, "cell"),
                RichSegment(SegmentKind.Text, " wall: "),
                RichSegment(SegmentKind.Math, "C_{A0} = 2"),
                RichSegment(SegmentKind.Text, " mol/L costs $5 or $10"),
            ),
            parseItemLine("The **cell**\n  wall: \$C_{A0} = 2$ mol/L costs $5 or $10"),
        )
    }

    @Test
    fun itemTextKeepsAProgramsIndentationInAFencedBlockAndReadsTextAfterIt() {
        val code = "for i in range(3):\n    if i > 0:\n        print(i)\nprint(\"done\")"
        val blocks = parseItemText("What does this print?\n```python\n$code\n```\nPick one.")

        assertEquals(3, blocks.size)
        assertEquals(ItemBlock.Code(code, "python"), blocks[1])
        assertEquals("Pick one.", (blocks[2] as ItemBlock.Paragraph).segments.joinToString("") { it.text })
    }

    @Test
    fun anAnswersCodeBlockReadsAsOneRunOfInlineCode() {
        assertEquals(
            listOf(
                RichSegment(SegmentKind.Text, "Troque por"),
                RichSegment(SegmentKind.Text, " "),
                RichSegment(SegmentKind.Code, "int total = 0; total++;"),
            ),
            parseItemLine("Troque por\n```java\nint total = 0;\ntotal++;\n```"),
        )
    }
}
