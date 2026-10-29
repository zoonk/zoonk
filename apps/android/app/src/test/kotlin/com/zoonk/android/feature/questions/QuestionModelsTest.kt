package com.zoonk.android.feature.questions

import com.zoonk.android.data.recode
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.richtext.SegmentKind
import com.zoonk.api.ApiJson
import com.zoonk.api.models.BankQuestion
import com.zoonk.api.models.CheckpointQuestionsInner
import com.zoonk.api.models.MistakePracticeFeedback
import com.zoonk.api.models.StudyAnswerFeedback
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QuestionModelsTest {
    private val blockQuestion =
        """
        {"answered":null,"capsuleKey":null,"citation":{"checkedAt":"2026-10-01T00:00:00Z","publisher":"INEP","text":"ENEM 2023","title":null,"url":null},
        "context":"A shop sells shirts.","drill":{"kind":"timed","lesson":null,"timeLimitSeconds":45},"entry":null,"format":"multipleChoice",
        "image":null,"itemId":"0b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","left":null,"mistakeId":"1b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        "options":["2","9","11"],"placement":false,"question":"Which are prime?","quoted":true,"right":null,"select":2,
        "set":{"count":3,"id":"2b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","kind":"chart","listening":null,"position":0,"source":"IBGE","text":null,"title":"Rain",
        "visual":{"kind":"timeline","title":"Brazil","events":[{"date":"1822","label":"Independence","detail":null}]}},
        "skillId":"3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","timeMachine":null,"unit":null,"visual":null}
        """.trimIndent()

    @Test
    fun readsABlocksQuestionWithItsSetDrillAndCitation() {
        val question = ApiJson.decodeFromString<CheckpointQuestionsInner>(blockQuestion).recode<CheckpointQuestionsInner, Question>()

        assertEquals(QuestionFormat.MultipleChoice, question.format)
        assertEquals(Select.Count(2), question.select)
        assertTrue(question.select.isMulti)
        assertEquals(Drill(Drill.Kind.Timed, timeLimitSeconds = 45), question.drill)
        assertEquals("ENEM 2023", question.citation?.text)
        assertEquals(LessonVisual.Timeline("Brazil", listOf(LessonVisual.Timeline.Event("1822", "Independence"))), question.set?.visual)
        assertEquals(ItemSet.Kind.Chart, question.set?.kind)
        assertTrue(question.quoted)
    }

    @Test
    fun readsARecordingSetsPlays() {
        val recording =
            blockQuestion.replace(
                """"kind":"chart","listening":null""",
                """"kind":"audio","listening":{"audio":{"durationMs":61000,"url":"https://cdn.zoonk.test/a.mp3"},"plays":2,"task":null,"title":"At the station","transcript":null}""",
            )
        val question = ApiJson.decodeFromString<CheckpointQuestionsInner>(recording).recode<CheckpointQuestionsInner, Question>()

        assertEquals(2, question.set?.listening?.plays)
        assertEquals(
            "https://cdn.zoonk.test/a.mp3",
            question.set
                ?.listening
                ?.audio
                ?.url,
        )
    }

    @Test
    fun readsATestOutsStatementAndAnAllPick() {
        val statement =
            ApiJson.decodeFromString<BankQuestion>(
                """{"context":null,"image":null,"itemId":"0b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","skillId":"3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
                |"visual":null,"format":"trueFalse","options":null,"question":"Water boils at 90 °C at sea level."}
                """.trimMargin(),
            )
        val question = statement.recode<BankQuestion, Question>()

        assertEquals(QuestionFormat.TrueFalse, question.format)
        assertEquals(null, question.options)
        assertEquals(Select.All, Json.decodeFromString<Select>("\"all\""))
        assertTrue(Select.All.isComplete(listOf(1)))
        assertTrue(!Select.Count(2).isComplete(listOf(1)))
    }

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
    fun readsABlocksAndAMistakesFeedback() {
        val block =
            ApiJson
                .decodeFromString<StudyAnswerFeedback>(
                    """{"blank":false,"correctAnswer":{"number":68},"explanation":"15% of 80 is 12.","hyperdrive":{"level":1,"streak":0},
                    |"isCorrect":false,"mistakeFixed":false,"pauseSuggested":false,"reinforcementLessons":null,"savedToNotebook":true,
                    |"transcript":null,"trap":null,"workedSteps":["0.15 × 80 = 12","80 − 12 = 68"]}
                    """.trimMargin(),
                ).recode<StudyAnswerFeedback, AnswerFeedback>()
        val mistake =
            ApiJson
                .decodeFromString<MistakePracticeFeedback>(
                    """{"answerId":"0b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","correctAnswer":{"selectedIndex":1},"explanation":null,"fixed":true,
                    |"fixedMistakeIds":["0b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","1b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"],"isCorrect":true,"mistakeStatus":"fixed","reached":{"energy":null,"level":null},"trap":"Two look alike."}
                    """.trimMargin(),
                ).recode<MistakePracticeFeedback, AnswerFeedback>()

        assertEquals(Answer.Numeric(68.0), block.correctAnswer)
        assertEquals(listOf("0.15 × 80 = 12", "80 − 12 = 68"), block.workedSteps)
        assertTrue(block.savedToNotebook)
        assertEquals(Answer.Choice(1), mistake.correctAnswer)
        assertEquals("Two look alike.", mistake.trap)
        assertEquals(2, mistake.fixedCount)
        assertEquals(1, AnswerFeedback(isCorrect = true, mistakeFixed = true).fixedCount)
    }

    @Test
    fun itemTextKeepsTablesAndLeavesMathAsText() {
        val blocks = parseItemText("Costs $5 and $10.\nIt's **cheap**.\n\n| Item | Price |\n| --- | ---: |\n| Shirt | R$ 80 |")

        assertEquals(2, blocks.size)
        val paragraph = blocks[0] as ItemBlock.Paragraph
        assertEquals("Costs $5 and $10.\nIt's cheap.", paragraph.segments.joinToString("") { it.text })
        assertTrue(paragraph.segments.any { it.kind == SegmentKind.Bold && it.text == "cheap" })
        val table = blocks[1] as ItemBlock.Table
        assertEquals("R$ 80", table.rows[0][1][0].text)
    }

    @Test
    fun anOptionReadsAsOneLineOfPlainWords() {
        assertEquals("The cell wall", plainItemLine("The **cell**\n  wall"))
        assertEquals("15 %", plainItemLine("15 %"))
    }
}
