package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanEffect
import kotlinx.serialization.json.JsonNull
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
    fun noDateIsSentAsAnExplicitNull() {
        val json = PlanOp.TargetDate(null).toJson()!!

        assertEquals(JsonNull, json["targetDate"])
        assertEquals(PlanOp.TargetDate(null), PlanOp.of(json))
        assertEquals(PlanOp.TargetDate(LocalDate.of(2027, 1, 31)), PlanOp.of(PlanOp.TargetDate(LocalDate.of(2027, 1, 31)).toJson()!!))
    }

    @Test
    fun onlyTheServersOwnOperationsCantBeSent() {
        assertNull(PlanOp.FollowNotice.toJson())
        assertEquals(
            "setWeekdayMinutes",
            PlanOp
                .WeekdayMinutes(listOf(0, 6), 30)
                .toJson()!!["kind"]
                .toString()
                .trim('"'),
        )
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
