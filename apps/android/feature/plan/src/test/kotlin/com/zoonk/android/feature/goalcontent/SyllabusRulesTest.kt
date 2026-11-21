package com.zoonk.android.feature.goalcontent

import com.zoonk.api.models.SyllabusChapter
import org.junit.Assert.assertEquals
import org.junit.Test

class SyllabusRulesTest {
    @Test
    fun chaptersTestedOutOfCountAlongWithChaptersStudied() {
        val studied = chapter(SyllabusChapter.State.DONE)
        val skipped = chapter(SyllabusChapter.State.DONE, known = true)
        val chapters =
            listOf(studied, skipped, studied, skipped, chapter(SyllabusChapter.State.CURRENT)) +
                List(5) { chapter(SyllabusChapter.State.UPCOMING) }

        assertEquals(listOf(studied, skipped, studied, skipped), chapters.doneChapters)
    }

    private fun chapter(
        state: SyllabusChapter.State,
        known: Boolean = false,
    ) = SyllabusChapter(
        chapterId = null,
        far = false,
        known = known,
        lessonsDone = 0,
        lessonsTotal = 1,
        nextDate = null,
        plannedLessons = null,
        position = 1,
        skillId = null,
        state = state,
        title = "Chapter",
        writing = false,
    )

    @Test
    fun subjectsWithNoHeadingComeFirstAndOptionalStudyLast() {
        val groups = groupSubjects(examSyllabus(strategy = true).subjects, modules = false)

        assertEquals(listOf(false to null, false to "Day 1", false to "Day 2", true to null), groups.map { it.extra to it.name })
        assertEquals(listOf("Study skills"), groups[0].subjects.map { it.shortName })
        assertEquals(listOf("Exam strategy"), groups[3].subjects.map { it.shortName })
    }

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
}
