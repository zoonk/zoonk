package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.ApiRequestJson
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.PlanOperation
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class PlanOpTest {
    @Test
    fun aChangesOperationsReadByKind() {
        val change =
            planChange(
                """[{"kind":"setDailyMinutes","minutes":40},{"kind":"setTargetDate","targetDate":null},
                   {"kind":"focusAreas","areas":["Math"],"parts":[{"area":"Math","name":"geometry","skillIds":["s1"]}]},
                   {"kind":"addSkills","skills":[{"name":"SQL","skillId":"k1","lessons":3,"area":null,"beforeSkillId":null}]},{"kind":"setExamChoice","group":"Language","subject":"English"}]""",
            )

        assertEquals(
            listOf(
                PlanOp.DailyMinutes(40),
                PlanOp.TargetDate(null),
                PlanOp.FocusAreas(listOf("Math"), listOf(FocusPart("Math", "geometry", listOf("s1")))),
                PlanOp.AddSkills(listOf("SQL")),
                PlanOp.ExamChoice("Language", "English"),
            ),
            change.operations.map { it.op },
        )
    }

    @Test
    fun eachOperationEncodesAsTheContractTakesItAndReadsBack() {
        val sent =
            mapOf(
                PlanOp.DailyMinutes(40) to """{"kind":"setDailyMinutes","minutes":40}""",
                PlanOp.WeekdayMinutes(listOf(0, 6), 30) to """{"kind":"setWeekdayMinutes","weekdays":[0,6],"minutes":30}""",
                PlanOp.LightWeek(LocalDate.of(2027, 1, 4)) to """{"kind":"addLightWeek","startDate":"2027-01-04"}""",
                PlanOp.MoveWeeklyEvent(LocalDate.of(2027, 1, 9), LocalDate.of(2027, 1, 10)) to
                    """{"kind":"moveWeeklyEvent","from":"2027-01-09","to":"2027-01-10"}""",
                PlanOp.TargetDate(null) to """{"kind":"setTargetDate","targetDate":null}""",
                PlanOp.TargetDate(LocalDate.of(2027, 1, 31)) to """{"kind":"setTargetDate","targetDate":"2027-01-31"}""",
                PlanOp.FocusAreas(listOf("Math")) to """{"kind":"focusAreas","areas":["Math"]}""",
                PlanOp.FocusAreas(listOf("Science"), listOf(FocusPart("Science", "biology", listOf("s1")))) to
                    """{"kind":"focusAreas","areas":["Science"],"parts":[{"area":"Science","name":"biology","skillIds":["s1"]}]}""",
                PlanOp.ReduceAreas(listOf("Math")) to """{"kind":"reduceAreas","areas":["Math"]}""",
                PlanOp.SkipAreas(listOf("Math")) to """{"kind":"skipAreas","areas":["Math"]}""",
                PlanOp.RestoreAreas(listOf("Math")) to """{"kind":"restoreAreas","areas":["Math"]}""",
                PlanOp.AreaStart(listOf("Math"), pastBasics = true) to """{"kind":"setAreaStart","areas":["Math"],"start":"pastBasics"}""",
                PlanOp.AreaStart(listOf("Math"), pastBasics = false) to """{"kind":"setAreaStart","areas":["Math"],"start":"basics"}""",
                PlanOp.SkipActivities(listOf("listening")) to """{"kind":"skipActivities","activities":["listening"]}""",
                PlanOp.RestoreActivities(listOf("speaking")) to """{"kind":"restoreActivities","activities":["speaking"]}""",
                PlanOp.PracticeBias("morePractice") to """{"kind":"setPracticeBias","bias":"morePractice"}""",
                PlanOp.DifficultyBias("harder") to """{"kind":"setDifficultyBias","bias":"harder"}""",
                PlanOp.WrittenCadence("finalWeeks") to """{"kind":"setWrittenCadence","cadence":"finalWeeks"}""",
                PlanOp.FullCourse(true) to """{"kind":"setFullCourse","fullCourse":true}""",
                PlanOp.BaseChoices(listOf(BaseChoice("k1", "quick"))) to
                    """{"kind":"setBaseChoices","choices":[{"skillId":"k1","choice":"quick"}]}""",
                PlanOp.FitLessons to """{"kind":"fitLessons"}""",
            )

        sent.forEach { (op, json) ->
            val encoded = ApiRequestJson.encodeToJsonElement(PlanOperation.serializer(), op.toOperation()!!)
            assertEquals(Json.parseToJsonElement(json), encoded)
            assertEquals(op, PlanOp.of(encoded.jsonObject))
        }
    }

    @Test
    fun onlyTheServersOwnOperationsCantBeSent() {
        listOf(
            PlanOp.AddSkills(listOf("SQL")),
            PlanOp.Tools(listOf(ToolPick("Python", "setup", "mac"))),
            PlanOp.FollowNotice,
            PlanOp.NoticeDate(LocalDate.of(2027, 1, 31), estimated = true),
            PlanOp.FitPhaseDates,
            PlanOp.ExamChoice("Language", "English"),
            PlanOp.Unknown,
        ).forEach { assertNull(it.toOperation()) }
    }

    @Test
    fun anEndMovedByADayBesideLessonsIsntSaid() {
        val moved =
            ApiJson.decodeFromString<PlanEffect>(
                """{"lessonsAdded":0,"lessonsRemoved":0,"endDateBefore":"2027-01-10","endDateAfter":"2027-01-09"}""",
            )
        val withLessons =
            ApiJson.decodeFromString<PlanEffect>(
                """{"lessonsAdded":0,"lessonsRemoved":2,"endDateBefore":"2027-01-10","endDateAfter":"2027-01-09"}""",
            )

        assertEquals(LocalDate.of(2027, 1, 10) to LocalDate.of(2027, 1, 9), shownEndMove(moved))
        assertNull(shownEndMove(withLessons))
    }

    @Test
    fun aCountIsByTheDateOnlyWhileThePlanEndsByIt() {
        val ends = ApiJson.decodeFromString<PlanEffect>("""{"lessonsAdded":1,"lessonsRemoved":0,"endDateAfter":"2027-02-01"}""")

        assertTrue(countsByDate(ends, LocalDate.of(2027, 3, 1)))
        assertFalse(countsByDate(ends, LocalDate.of(2027, 1, 1)))
        assertFalse(countsByDate(ends, null))
    }

    @Test
    fun aNoticesNumberingLeavesTheTopic() {
        assertEquals("Noções de lógica", topicWords("12 Noções de lógica"))
        assertEquals("Identify the theme", topicWords("H18 - Identify the theme"))
        assertEquals("2026 in numbers", topicWords("2026 in numbers"))
    }
}
