package com.zoonk.android.feature.mindmaps

import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.GoalMindMaps
import com.zoonk.api.models.SavedMindMapKind
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

/** The Mind maps page's tabs, each its own deck to study. */
enum class StudyTab(
    val key: String,
) {
    Chapters("chapters"),
    Lessons("lessons"),
    Saved("saved"),
    ;

    companion object {
        fun of(key: String?): StudyTab? = entries.firstOrNull { it.key == key }
    }
}

val GoalMindMaps.FirstTab.tab: StudyTab
    get() = if (this == GoalMindMaps.FirstTab.LESSONS) StudyTab.Lessons else StudyTab.Chapters

/** One map of a deck, as the deck froze it when it opened. */
@Serializable
sealed interface DeckSlot {
    val chapterId: String

    @Serializable
    @SerialName("chapter")
    data class Chapter(
        override val chapterId: String,
    ) : DeckSlot

    /** The chapter's [index]th lesson map that opens, read when the deck reaches the chapter. */
    @Serializable
    @SerialName("lessonOf")
    data class LessonOf(
        override val chapterId: String,
        val index: Int,
    ) : DeckSlot

    @Serializable
    @SerialName("lesson")
    data class Lesson(
        override val chapterId: String,
        val lessonId: String,
    ) : DeckSlot
}

/** A map by what it is, not where it sits in a deck: a chapter's, or one of its lessons'. */
@Serializable
data class MapPlace(
    val chapterId: String,
    val lessonId: String? = null,
) {
    /** The route's `start`: the chapter's id, then the lesson's after a slash. */
    val start: String get() = listOfNotNull(chapterId, lessonId).joinToString("/")

    companion object {
        fun of(start: String?): MapPlace? {
            val parts = start?.split("/")?.filter { it.isNotEmpty() } ?: return null
            return parts.firstOrNull()?.let { MapPlace(it, parts.getOrNull(1)) }
        }
    }
}

/**
 * The tab's maps in syllabus order, Plus-locked ones left out: chapters' ready maps; every chapter's
 * open lesson maps, counted from the list so the deck knows its length before any is read; or the
 * saved maps that open.
 */
fun GoalMindMaps.deck(tab: StudyTab): List<DeckSlot> =
    when (tab) {
        StudyTab.Chapters -> {
            chapters.filter { it.opens }.map { DeckSlot.Chapter(it.chapterId.toString()) }
        }

        StudyTab.Lessons -> {
            lessonGroups.flatMap { group ->
                List((group.count - group.locked).toInt()) { DeckSlot.LessonOf(group.chapterId.toString(), it) }
            }
        }

        StudyTab.Saved -> {
            saved.filter { it.available }.mapNotNull { entry ->
                val chapterId = entry.chapterId?.toString() ?: return@mapNotNull null
                when (entry.kind) {
                    SavedMindMapKind.CHAPTER -> DeckSlot.Chapter(chapterId)
                    SavedMindMapKind.LESSON -> DeckSlot.Lesson(chapterId, entry.targetId.toString())
                }
            }
        }
    }

/** A chapter map ready to read. */
val GoalMindMap.opens: Boolean get() = status == GoalMindMap.Status.READY && outline != null

/**
 * Where [place] sits in the deck, or null when it isn't in it. A lesson in a chapter's run of lesson
 * maps is found among [openLessons] (the chapter's open lesson ids, once read), and otherwise opens
 * at the chapter's first.
 */
fun List<DeckSlot>.indexOf(
    place: MapPlace,
    openLessons: (chapterId: String) -> List<String>?,
): Int? {
    val exact =
        indexOfFirst { slot ->
            when (slot) {
                is DeckSlot.Chapter -> place.lessonId == null && slot.chapterId == place.chapterId
                is DeckSlot.Lesson -> slot.lessonId == place.lessonId
                is DeckSlot.LessonOf -> false
            }
        }
    if (exact >= 0) return exact

    val first = indexOfFirst { it is DeckSlot.LessonOf && it.chapterId == place.chapterId }
    if (first < 0) return null
    val count = count { it is DeckSlot.LessonOf && it.chapterId == place.chapterId }
    val within = place.lessonId?.let { openLessons(place.chapterId)?.indexOf(it) } ?: 0
    return first + within.coerceIn(0, count - 1)
}

/** What [slot] shows, to resume at; a lesson the deck hasn't read yet is its chapter's run. */
fun DeckSlot.place(openLessons: (chapterId: String) -> List<String>?): MapPlace =
    when (this) {
        is DeckSlot.Chapter -> MapPlace(chapterId)
        is DeckSlot.Lesson -> MapPlace(chapterId, lessonId)
        is DeckSlot.LessonOf -> MapPlace(chapterId, openLessons(chapterId)?.getOrNull(index))
    }

/** Where this device stopped in a goal's tab, kept with the learner's other work on the device. */
fun studyPlaceKey(
    goalId: UUID,
    tab: StudyTab,
): String = "mind-maps-place:$goalId:${tab.key}"
