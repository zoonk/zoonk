package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.feature.onboarding.chapterOf
import com.zoonk.android.feature.onboarding.feasibilityOf
import com.zoonk.android.feature.onboarding.numbersOf
import com.zoonk.android.feature.onboarding.phaseOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.subjectOf
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.onboarding.topicOf
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class RevealShapeTest {
    private val today = LocalDate.now()

    @Test
    fun factsCountTheDaysToTheGoalAndRoundTheStudyTime() {
        assertEquals(
            RevealFacts(days = 53, daysEstimated = false, end = null, endAsMonth = false, dailyMinutes = 30, studyMinutes = 1260),
            planOf(numbers = numbersOf(beforeDeadlineMinutes = 1234.0)).revealFacts(today),
        )
        assertEquals(95, planOf(numbers = numbersOf(beforeDeadlineMinutes = 93.0)).revealFacts(today).studyMinutes)
        assertEquals(0, planOf().revealFacts(today).studyMinutes)
    }

    @Test
    fun aPlanWithoutADateEndsAtItsPaceAsAMonthWhenFarOff() {
        val near = planOf(targetDate = null, endDate = today.plusDays(30)).revealFacts(today)
        val far = planOf(targetDate = null, endDate = today.plusDays(200)).revealFacts(today)

        assertEquals(today.plusDays(30) to false, near.end to near.endAsMonth)
        assertEquals(today.plusDays(200) to true, far.end to far.endAsMonth)
        assertNull(far.days)
    }

    @Test
    fun aPlanOfOnePhaseShowsItsChaptersWithoutTheOnesWrittenAhead() {
        val chapters = "[${chapterOf("Contracts")},${chapterOf("", writing = true)},${chapterOf("Torts")}]"
        val plan = planOf(phases = listOf(phaseOf(0, "learn", "current", today, today.plusDays(30), chapters)))

        assertEquals(listOf("Contracts", "Torts"), plan.revealChapters().map { it.title })
        assertEquals(emptyList<Any>(), planOf().revealChapters())
    }

    @Test
    fun theCurrentPhaseCountsItsDays() {
        val phase = planOf().roadmapPhases.first()

        assertEquals(PhaseDay(day = 1, days = 21), phase.dayOf(today))
        assertEquals(PhaseDay(day = 21, days = 21), phase.dayOf(today.plusDays(90)))
    }

    @Test
    fun aFreeWeekThatEndedComesFirst() {
        assertEquals(
            RevealCoverage.FreeWeekOver,
            revealCoverage(planOf(freeWeekOver = true, feasibility = feasibilityOf()), Goal.Kind.EXAM, null),
        )
    }

    @Test
    fun timeThatDoesNotCoverEverythingSaysWhatItCovers() {
        val coverage = revealCoverage(planOf(feasibility = feasibilityOf(coreFits = false)), Goal.Kind.EXAM, syllabusOf(emptyList()))

        assertEquals(false, (coverage as RevealCoverage.Covered).feasibility.coreFits)
    }

    @Test
    fun aPlanThatFitsSummarizesTheNoticesTopics() {
        val topics = "[${topicOf("Offer")},${topicOf("Acceptance")},${topicOf("Remedies", "notPlanned", "time")}]"
        val syllabus = syllabusOf(listOf(subjectOf("Contracts", topics = topics), subjectOf("Torts")), topicCount = 3)

        assertEquals(
            RevealCoverage.Summary(SummaryTitle.Subjects(2, ExamDocument.NOTICE), SummaryDetail.DontFit(leftOut = 1, total = 3)),
            revealCoverage(planOf(), Goal.Kind.EXAM, syllabus),
        )
    }

    @Test
    fun basicsTheLearnerStartsPastAreNotLeftOut() {
        val topics = "[${topicOf("Offer")},${topicOf("Basics", "notPlanned", "pastBasics")}]"
        val syllabus = syllabusOf(listOf(subjectOf("Contracts", topics = topics), subjectOf("Torts")), topicCount = 2)

        assertEquals(SummaryDetail.AllPlanned(2), (revealCoverage(planOf(), Goal.Kind.EXAM, syllabus) as RevealCoverage.Summary).detail)
    }

    @Test
    fun aNoticeWithoutTopicsNamesItsHeaviestSubjects() {
        val syllabus = syllabusOf(listOf(subjectOf("Ethics", questions = 15), subjectOf("Civil", questions = 12)))

        assertEquals(
            SummaryDetail.MostQuestions(listOf("Ethics" to 15L, "Civil" to 12L)),
            (revealCoverage(planOf(), Goal.Kind.EXAM, syllabus) as RevealCoverage.Summary).detail,
        )
    }

    @Test
    fun aPlansModulesAreNamedAndALanguageHasNoSummary() {
        val modules = syllabusOf(listOf(subjectOf("Basics"), subjectOf("Tenses"), subjectOf("Travel")), kind = "modules")

        assertEquals(
            RevealCoverage.Summary(SummaryTitle.Modules(3), SummaryDetail.Names(listOf("Basics", "Tenses"))),
            revealCoverage(planOf(), Goal.Kind.LEARN, modules),
        )
        assertNull(revealCoverage(planOf(), Goal.Kind.LANGUAGE, modules))
    }

    @Test
    fun areasAreWeighedHeaviestFirstWithTheEstimatedOnesCounted() {
        val syllabus =
            syllabusOf(
                listOf(
                    subjectOf("Ethics", percent = 20),
                    subjectOf("Civil", percent = 50),
                    subjectOf("Criminal", percent = 30, assumed = true),
                ),
            )
        val weights = syllabus.areaWeights()!!

        assertEquals(listOf("Civil", "Criminal", "Ethics"), weights.areas.map { it.name })
        assertEquals(1, weights.assumed)
        assertEquals(WeightSource.Notice, weights.source)
        assertNull(syllabusOf(listOf(subjectOf("Ethics", percent = 100))).areaWeights())
    }
}
