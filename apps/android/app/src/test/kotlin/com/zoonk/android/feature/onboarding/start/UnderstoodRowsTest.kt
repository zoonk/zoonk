package com.zoonk.android.feature.onboarding.start

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.goalsUnderstanding
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalUnderstandingOneOf
import com.zoonk.api.models.OnboardingExamDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.util.Locale

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en")
class UnderstoodRowsTest {
    private val today = LocalDate.of(2026, 10, 28)
    private val rows = UnderstoodRows(RuntimeEnvironment.getApplication().resources, Locale.US, is24Hour = false, today = today)

    private fun understanding(json: String): GoalUnderstandingOneOf = ApiJson.decodeFromString(json)

    private fun day(
        date: String,
        source: Boolean = true,
        estimated: Boolean = false,
        closed: Boolean = false,
    ) =
        """{"date":"$date","estimated":$estimated,"label":"Exam","registrationClosed":$closed,"source":${if (source) """{"title":"Edital 2026","url":"https://exam.gov/edital.pdf"}""" else "null"}}"""

    private fun dateRow(understanding: GoalUnderstandingOneOf) =
        rows.rows(understanding.goals.single()).single {
            it.editable ==
                EditableField.TargetDate
        }

    @Test
    fun anOfficialDateCountsDownWithItsSource() {
        val row = dateRow(understanding(goalsUnderstanding(examDates = "[${day("2026-11-08")}]", targetDate = "2026-11-08")))

        assertEquals("Exam date", row.label)
        assertEquals("November 8, 2026", row.value)
        assertEquals("11 days left", row.note)
        assertEquals(RowSource("Edital 2026", "https://exam.gov/edital.pdf"), row.source)
        assertNull(row.suggestedDate)
    }

    @Test
    fun anExamWithoutDatesWaitsForItsNotice() {
        val row = dateRow(understanding(goalsUnderstanding(details = """{"examYear":2027}""")))

        assertEquals("2027, to be confirmed", row.value)
        assertEquals("The official date comes out in the exam's notice. Know it already? Set it here.", row.note)
    }

    @Test
    fun anExamHeldSeveralTimesAYearAsksWhichSitting() {
        val dates = listOf("2026-12-05", "2027-03-06", "2027-06-05", "2027-09-04").joinToString(",") { day(it) }
        val row = dateRow(understanding(goalsUnderstanding(examDates = "[$dates]")))

        assertEquals("Pick your date", row.value)
        assertEquals(listOf("2026-12-05", "2027-03-06", "2027-06-05").map(LocalDate::parse), row.choiceDates)
    }

    @Test
    fun aMonthTheLearnerNamedStaysUntilTheyPickTheNoticesDay() {
        val row =
            dateRow(
                understanding(
                    goalsUnderstanding(
                        details = """{"examMonth":12,"examYear":2026}""",
                        examDates = "[${day("2026-11-08")},${day("2026-11-15")}]",
                    ),
                ),
            )

        assertEquals("December 2026", row.value)
        assertEquals("The exam notice says November 8.", row.note)
        assertEquals(LocalDate.of(2026, 11, 8), row.suggestedDate)
    }

    @Test
    fun aSittingsDaysShowTogether() {
        val row = dateRow(understanding(goalsUnderstanding(examDates = "[${day("2026-11-08")},${day("2026-11-15")}]")))

        assertEquals("Exam dates", row.label)
        assertEquals("November 8 and November 15, 2026", row.value.plain())
        assertEquals("11 days left", row.note)
    }

    @Test
    fun factsTheTitleAlreadySaysArentRepeated() {
        val goal =
            understanding(
                goalsUnderstanding(
                    title = "Get into Medicine",
                    kind = "learn",
                    details = """{"targetCourse":"medicine","institution":"USP","reason":"My dream"}""",
                ),
            ).goals.single()

        assertEquals(listOf("title", "institution", "reason"), rows.rows(goal).map { it.id })
    }

    @Test
    fun theScheduleShowsOnlyWhatTheLearnerSaid() {
        val schedule = understanding(goalsUnderstanding()).schedule

        assertNull(rows.scheduleRow(schedule, minutesSaid = false))
        assertEquals("15 min a day", rows.scheduleRow(schedule, minutesSaid = true)?.value?.plain())
        assertEquals("8:00 PM", rows.scheduleRow(schedule.copy(studyTime = "20:00"), minutesSaid = false)?.value?.plain())
    }

    @Test
    fun sittingsAreDaysAtMostTwoWeeksApartAndClosedOnesAreSkipped() {
        val days =
            listOf(day("2026-11-08"), day("2026-11-15"), day("2027-03-06", closed = true), day("2027-06-05"))
                .map { ApiJson.decodeFromString<OnboardingExamDate>(it) }

        assertEquals(3, ExamSittings.group(days).size)
        assertEquals(listOf("2026-11-08", "2027-06-05").map(LocalDate::parse), ExamSittings.openSittings(3, days, today).map { it.day })
        assertEquals(
            listOf("2027-06-05").map(LocalDate::parse),
            ExamSittings.learnerSitting(days, today, LocalDate.of(2027, 6, 1))?.map { it.day },
        )
    }
}

/** Formatters keep a number and its unit together with no-break spaces. */
private fun String.plain() = replace('\u00A0', ' ').replace('\u202F', ' ')
