package com.zoonk.android.feature.savedlessons

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Saves
import com.zoonk.android.data.Visit
import com.zoonk.android.data.perform
import com.zoonk.android.feature.completedlessons.CompletedLessonsStore
import com.zoonk.api.models.SaveLessonInput
import com.zoonk.api.models.SavedLessonList
import java.util.UUID

interface SavedLessonsApi {
    suspend fun list(
        session: AuthenticatedSession,
        goalId: UUID,
    ): SavedLessonList

    /** Whether it's saved now. */
    suspend fun save(
        session: AuthenticatedSession,
        goalId: UUID,
        lessonId: UUID,
        saved: Boolean,
    ): Boolean
}

class LiveSavedLessonsApi(
    private val api: ApiClients,
) : SavedLessonsApi {
    override suspend fun list(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).learner.listSavedLessons(goalId) }

    override suspend fun save(
        session: AuthenticatedSession,
        goalId: UUID,
        lessonId: UUID,
        saved: Boolean,
    ) = perform { api.clients(session).learner.saveLesson(goalId, SaveLessonInput(lessonId, saved)) }.saved
}

/** The lessons a learner saved to do again, newest save first, and saving one or removing it. */
class SavedLessonsStore(
    private val api: SavedLessonsApi,
    private val cache: AppCache,
    private val completedLessons: CompletedLessonsStore,
) {
    /** By goal: a goal lists a lesson saved from it, or one its plan has. The plan and the lessons' titles change it too. */
    val list: KeyedResources<UUID, SavedLessonList> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.SavedLessons, DataDomain.Goals)) { session, goalId ->
            session?.let { api.list(it, goalId) }
        }

    /**
     * Saves [lessonId] from [goalId] or removes it, as [saved] says. A lesson is saved once for the learner, so every
     * completed lessons list kept shows the answer at once; the lists read it again, since a read out then predates it.
     */
    suspend fun save(
        goalId: UUID,
        lessonId: UUID,
        saved: Boolean,
    ): MutationResult<Boolean> {
        val result = cache.mutate(invalidating = setOf(DataDomain.SavedLessons)) { api.save(it, goalId, lessonId, saved) }
        if (result is MutationResult.Done) {
            taken[lessonId] = (taken[lessonId] ?: 0) + 1
            lastTaken[lessonId] = result.value
            completedLessons.lessons.update({ true }) { list ->
                list.copy(`data` = list.`data`.map { if (it.lessonId == lessonId) it.copy(saved = result.value) else it })
            }
        }
        return result
    }

    /** How many saves of each lesson the server took, so a run's start sent before one never undoes it. */
    private val taken = mutableMapOf<UUID, Int>()
    private val lastTaken = mutableMapOf<UUID, Boolean>()

    /** Call it as the lesson's run start is sent; the call it returns turns what the run says into what to show. */
    fun runStarting(lessonId: UUID): (saved: Boolean) -> Boolean {
        val before = taken[lessonId]
        return { saved -> if (taken[lessonId] == before) saved else lastTaken.getValue(lessonId) }
    }

    private val queue = Saves<UUID>(cache)

    /** A screen's [visit] to the lesson saves, saving them from [goalId]. */
    fun saves(
        visit: Visit,
        goalId: UUID,
    ) = queue.on(visit) { lessonId, saved -> save(goalId, lessonId, saved) }
}
