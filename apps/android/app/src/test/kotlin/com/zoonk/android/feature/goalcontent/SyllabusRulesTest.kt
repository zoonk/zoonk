package com.zoonk.android.feature.goalcontent

import com.zoonk.api.models.SyllabusChapter
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.SyllabusTopic
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class SyllabusRulesTest {
    private val exam = examSyllabus()
    private val nature = exam.subjects.first { it.key == "natural-sciences" }

    @Test
    fun aNoticeNumberSplitsFromItsWords() {
        assertEquals(NumberedTopic(0, "1", "Mechanics"), splitTopicNumber("1 Mechanics"))
        assertEquals(NumberedTopic(2, "5.7.1", "Waves on strings"), splitTopicNumber("5.7.1. Waves on strings"))
        assertEquals(NumberedTopic(1, "H18", "Identify a cell's parts"), splitTopicNumber("H18 - Identify a cell's parts"))
    }

    @Test
    fun aYearOrAnUnspacedNumberStaysPartOfTheWords() {
        assertEquals(NumberedTopic(0, null, "2026 in numbers"), splitTopicNumber("2026 in numbers"))
        assertEquals(NumberedTopic(0, null, "3D printing"), splitTopicNumber("3D printing"))
    }

    @Test
    fun aNoBreakSpaceAfterTheNumberCountsAsASpace() {
        assertEquals(NumberedTopic(1, "2.1", "Optics"), splitTopicNumber("2.1 Optics"))
    }

    @Test
    fun subItemsGroupUnderTheItemBeforeThemAtTheListsTopLevel() {
        val groups = groupTopics(listOf("1.1 A", "1.1.1 B", "1.1.2 C", "1.2 D")) { it }

        assertEquals(listOf("A", "D"), groups.map { it.text })
        assertEquals(listOf(1, 1), groups[0].children.map { it.depth })
        assertEquals(emptyList<TopicChild<String>>(), groups[1].children)
    }

    @Test
    fun aMatrixItemSplitsItsLabelFromItsWords() {
        assertEquals(
            NamedItem("Competency 1", "Understand the sciences"),
            splitNamedItem("Competency 1 – Understand the sciences"),
        )
        assertEquals(NamedItem(null, "Weigh the environment"), splitNamedItem("Weigh the environment"))
    }

    @Test
    fun theNoticesGroupsComeInItsOrderAndThePlansExtrasLast() {
        val groups = groupSubjects(exam.subjects, modules = false)

        assertEquals(listOf("Day 1", "Day 2", null), groups.map { it.name })
        assertEquals(listOf(false, false, true), groups.map { it.extra })
        assertEquals(listOf("spanish", "essay"), groups[0].subjects.map { it.key })
    }

    @Test
    fun aPlansModulesAreOneGroup() {
        val groups = groupSubjects(modulesSyllabus().subjects, modules = true)

        assertEquals(1, groups.size)
        assertNull(groups.single().name)
    }

    @Test
    fun appearsALotMarksRowsOnlyWhenItSetsSomeApart() {
        val high = SyllabusTopic.Frequency.HIGH
        assertTrue(setsApart(listOf(high, null)))
        assertFalse(setsApart(listOf(high, high)))
        assertFalse(setsApart(listOf(null, SyllabusTopic.Frequency.LOW)))
    }

    @Test
    fun topicsUnderOneHeadingComeTogetherInOrder() {
        val runs = splitByHeading(nature.topics)

        assertEquals(listOf("Physics", "Chemistry", "Biology"), runs.map { it.heading })
        assertEquals(5, runs[0].topics.size)
    }

    @Test
    fun aGroupsMarkReadsItsTopicsTogether() {
        val physics = groupTopics(splitByHeading(nature.topics)[0].topics) { it.name }

        assertEquals(TopicMark.Studied, physics[0].mark)
        assertEquals(TopicMark.InProgress(0.5), physics[1].mark)
        assertEquals(TopicMark.ToStudy, physics[2].mark)
        assertEquals(3 to 3, physics[0].studiedCount)
        assertNull(physics[1].studiedCount)
    }

    @Test
    fun aGroupLeftOutForTimeIsOutOfThePlan() {
        val chemistry = groupTopics(splitByHeading(nature.topics)[1].topics) { it.name }

        assertEquals(TopicMark.NotPlanned, chemistry[1].mark)
    }

    @Test
    fun aGroupListsEachChapterOnce() {
        val mechanics = groupTopics(nature.topics) { it.name }.first()

        assertEquals(listOf("Motion and forces", "Energy"), mechanics.chapters.map { it.title })
        assertEquals(SyllabusTopic.Frequency.HIGH, mechanics.frequency)
    }

    @Test
    fun onlyExamsAndPlansOfSeveralModulesHaveSubjectPages() {
        assertTrue(exam.hasSubjectPages)
        assertTrue(modulesSyllabus().hasSubjectPages)
        assertFalse(modulesSyllabus().copy(subjects = modulesSyllabus().subjects.take(1)).hasSubjectPages)
    }

    @Test
    fun anExamSubjectsBarIsItsPreparation() {
        assertEquals(SubjectBar(studied = 0.42, known = 0.0), nature.bar)
    }

    @Test
    fun aModulesBarSplitsStudiedFromKnown() {
        val basics = modulesSyllabus().subjects.first()

        assertEquals(SubjectBar(studied = 0.3, known = 0.2), basics.bar)
        assertEquals(0.5, basics.bar.share, 1e-9)
        assertEquals(0.5, basics.coverage.new, 1e-9)
    }

    @Test
    fun continueOpensTheFirstChapterNotDoneThatHasAPage() {
        assertEquals(UUID.fromString(chapterId(3)), nature.nextChapterId)
    }

    @Test
    fun aSubjectOutOfThePlanHasNothingToContinue() {
        val skipped = nature.copy(notPlannedReason = SyllabusSubject.NotPlannedReason.SKIPPED)

        assertNull(skipped.nextChapterId)
    }

    @Test
    fun chaptersStillBeingWrittenHaveNoPageToContinueTo() {
        val writing =
            nature.copy(
                chapters = nature.chapters.filter { it.state != SyllabusChapter.State.DONE }.map { it.copy(chapterId = null) },
            )

        assertNull(writing.nextChapterId)
    }
}
