package com.zoonk.android.feature.savedlessons

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.SavedLesson
import com.zoonk.api.models.SavedLessonList
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID

/** Saved lessons kept in memory, newest save first; each write waits for [hold] when set, and fails while [failing]. */
class FakeSavedLessonsApi(
    var lessons: List<SavedLesson> = emptyList(),
) : SavedLessonsApi {
    val writes = mutableListOf<Pair<UUID, Boolean>>()
    var reads = 0
    var hold: CompletableDeferred<Unit>? = null
    var failing = false

    override suspend fun list(
        session: AuthenticatedSession,
        goalId: UUID,
    ): SavedLessonList {
        reads++
        return SavedLessonList(lessons)
    }

    override suspend fun save(
        session: AuthenticatedSession,
        goalId: UUID,
        lessonId: UUID,
        saved: Boolean,
    ): Boolean {
        writes += lessonId to saved
        hold?.await()
        if (failing) throw ApiException(ApiError.Network)
        val existing = lessons.firstOrNull { it.lessonId == lessonId }
        lessons =
            when {
                !saved -> lessons.filterNot { it.lessonId == lessonId }
                existing != null -> lessons
                else -> listOf(savedLesson(lessonId)) + lessons
            }
        return saved
    }
}

fun savedLesson(
    lessonId: UUID,
    title: String = "Lesson",
    chapterTitle: String? = "Cells",
    available: Boolean = true,
) = SavedLesson(available = available, chapterTitle = chapterTitle, lessonId = lessonId, title = title)
