package com.zoonk.android.feature.mindmaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MindMapDeckTest {
    private val maps =
        goalMindMaps(
            lessonGroups =
                listOf(
                    lessonGroupJson(3, count = 3),
                    lessonGroupJson(5, count = 4, locked = 4),
                    lessonGroupJson(6, count = 2, locked = 1),
                ),
            saved =
                listOf(
                    savedJson("lesson", mapLesson(2), "Pitch", chapter = 3),
                    savedJson("chapter", mapChapter(1), "Motion and forces", chapter = 1),
                    savedJson("chapter", mapChapter(9), "Gone", chapter = null, available = false),
                ),
        )

    @Test
    fun aDeckHoldsOnlyTheMapsThatOpen() {
        assertEquals(listOf(DeckSlot.Chapter(mapChapter(1)), DeckSlot.Chapter(mapChapter(2))), maps.deck(StudyTab.Chapters))
        assertEquals(
            listOf(0, 1, 2).map { DeckSlot.LessonOf(mapChapter(3), it) } + DeckSlot.LessonOf(mapChapter(6), 0),
            maps.deck(StudyTab.Lessons),
        )
        assertEquals(
            listOf(DeckSlot.Lesson(mapChapter(3), mapLesson(2)), DeckSlot.Chapter(mapChapter(1))),
            maps.deck(StudyTab.Saved),
        )
    }

    @Test
    fun aLessonResumesAtItsPlaceInItsChaptersRunOnceTheChapterIsRead() {
        val deck = maps.deck(StudyTab.Lessons)
        val read = mapOf(mapChapter(3) to listOf(mapLesson(1), mapLesson(2), mapLesson(3)))

        assertEquals(1, deck.indexOf(MapPlace(mapChapter(3), mapLesson(2)), read::get))
        assertEquals(0, deck.indexOf(MapPlace(mapChapter(3), mapLesson(2))) { null })
        assertEquals(3, deck.indexOf(MapPlace(mapChapter(6)), read::get))
        assertNull(deck.indexOf(MapPlace(mapChapter(5)), read::get))
        assertEquals(MapPlace(mapChapter(3), mapLesson(3)), deck[2].place(read::get))
    }

    @Test
    fun aPlaceTravelsInTheRoutesStart() {
        val place = MapPlace(mapChapter(3), mapLesson(2))

        assertEquals(place, MapPlace.of(place.start))
        assertEquals(MapPlace(mapChapter(3)), MapPlace.of(mapChapter(3)))
        assertNull(MapPlace.of(null))
    }

    @Test
    fun anIndexFoldsItsSubjectsOnceItsLongAndShowsTheFirstRowsWithoutThem() {
        val short = boundedIndex(listOf(IndexGroup("a", "A", List(5) { it }), IndexGroup("b", "B", List(7) { it })), emptySet(), false)
        assertEquals(14, short.size)
        assertNull((short.first() as IndexEntry.Subject).open)

        val long = boundedIndex(listOf(IndexGroup("a", "A", List(5) { it }), IndexGroup("b", "B", List(8) { it })), setOf("b"), false)
        assertEquals(listOf(false, true), long.filterIsInstance<IndexEntry.Subject>().map { it.open })
        assertEquals(8, long.count { it is IndexEntry.Row })

        val plain = boundedIndex(listOf(IndexGroup("", null, List(10) { it })), emptySet(), false)
        assertEquals(IndexEntry.ShowAll(10), plain.last())
        assertEquals(8, plain.count { it is IndexEntry.Row })
        assertEquals(10, boundedIndex(listOf(IndexGroup("", null, List(10) { it })), emptySet(), true).size)
    }
}
