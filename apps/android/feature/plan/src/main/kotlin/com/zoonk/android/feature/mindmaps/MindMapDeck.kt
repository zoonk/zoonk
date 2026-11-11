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
 * open lesson maps, as the list names them, read when the deck reaches their chapter; or the saved
 * maps that open.
 */
fun GoalMindMaps.deck(tab: StudyTab): List<DeckSlot> =
    when (tab) {
        StudyTab.Chapters -> {
            chapters.filter { it.opens }.map { DeckSlot.Chapter(it.chapterId.toString()) }
        }

        StudyTab.Lessons -> {
            lessonGroups.flatMap { group ->
                group.lessonIds.map { DeckSlot.Lesson(group.chapterId.toString(), it.toString()) }
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

/** Where [place] sits in the deck, else its chapter's first map, or null when its chapter isn't in it. */
fun List<DeckSlot>.indexOfPlace(place: MapPlace): Int? {
    val exact = indexOfFirst { it.place == place }
    val chapter = indexOfFirst { it.chapterId == place.chapterId }
    return exact.takeIf { it >= 0 } ?: chapter.takeIf { it >= 0 }
}

/** The map [this] shows, to resume at. */
val DeckSlot.place: MapPlace
    get() =
        when (this) {
            is DeckSlot.Chapter -> MapPlace(chapterId)
            is DeckSlot.Lesson -> MapPlace(chapterId, lessonId)
        }

/** Where this device stopped in a goal's tab, kept with the learner's other work on the device. */
fun studyPlaceKey(
    goalId: UUID,
    tab: StudyTab,
): String = "mind-maps-place:$goalId:${tab.key}"
