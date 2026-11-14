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
}
