package com.zoonk.android.feature.mindmaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MindMapDeckTest {
    private val maps =
        goalMindMaps(
            lessonGroups =
                listOf(
                    lessonGroupJson(3, lessons = listOf(2, 3, 4)),
                    lessonGroupJson(6, lessons = listOf(7)),
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
            listOf(2, 3, 4).map { DeckSlot.Lesson(mapChapter(3), mapLesson(it)) } + DeckSlot.Lesson(mapChapter(6), mapLesson(7)),
            maps.deck(StudyTab.Lessons),
        )
        assertEquals(
            listOf(DeckSlot.Lesson(mapChapter(3), mapLesson(2)), DeckSlot.Chapter(mapChapter(1))),
            maps.deck(StudyTab.Saved),
        )
    }

    @Test
    fun aLessonsDeckHoldsTheLessonsItOpenedWithAndKnowsEachPlaceBeforeItsChapterIsRead() {
        val deck = maps.deck(StudyTab.Lessons)

        assertEquals(1, deck.indexOfPlace(MapPlace(mapChapter(3), mapLesson(3))))
        assertEquals(0, deck.indexOfPlace(MapPlace(mapChapter(3), mapLesson(9))))
        assertEquals(3, deck.indexOfPlace(MapPlace(mapChapter(6))))
        assertNull(deck.indexOfPlace(MapPlace(mapChapter(5))))
        assertEquals(MapPlace(mapChapter(3), mapLesson(4)), deck[2].place)
    }

    @Test
    fun aLessonPlacedInTwoChaptersIsTwoSlidesEachResumingInItsOwnChapter() {
        val deck =
            goalMindMaps(
                lessonGroups = listOf(lessonGroupJson(3, lessons = listOf(2)), lessonGroupJson(6, lessons = listOf(2))),
            ).deck(StudyTab.Lessons)

        assertEquals(deck.size, deck.map { it.key }.toSet().size)
        assertEquals(1, deck.indexOfPlace(MapPlace(mapChapter(6), mapLesson(2))))
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
