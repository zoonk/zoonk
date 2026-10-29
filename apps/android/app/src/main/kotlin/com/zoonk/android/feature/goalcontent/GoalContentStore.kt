package com.zoonk.android.feature.goalcontent

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.AreaPractice
import com.zoonk.api.models.AreaPracticeInput
import com.zoonk.api.models.GoalChapter
import com.zoonk.api.models.StudyBlock
import kotlinx.datetime.TimeZone
import java.util.UUID

data class ChapterKey(
    val goalId: UUID,
    val chapterId: UUID,
)

interface GoalContentApi {
    suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): GoalChapter

    suspend fun practiceArea(
        session: AuthenticatedSession,
        goalId: UUID,
        input: AreaPracticeInput,
    ): AreaPractice
}

class LiveGoalContentApi(
    private val api: ApiClients,
) : GoalContentApi {
    override suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ) = perform { api.clients(session).learner.getGoalChapter(key.goalId, key.chapterId) }

    override suspend fun practiceArea(
        session: AuthenticatedSession,
        goalId: UUID,
        input: AreaPracticeInput,
    ) = perform { api.clients(session).studySessions.createAreaPractice(goalId, input) }
}

sealed interface PracticeOutcome {
    data class Opened(
        val route: AppRoute,
    ) : PracticeOutcome

    data object DailyCap : PracticeOutcome

    data object NothingToPractice : PracticeOutcome

    data object Failed : PracticeOutcome
}

/** A goal's chapter pages, and practice on a chapter; the subject page changes the plan through the Plan's store. */
class GoalContentStore(
    private val api: GoalContentApi,
    private val cache: AppCache,
    private val timeZone: () -> TimeZone = TimeZone::currentSystemDefault,
) {
    // Subscribing opens the lessons a free exam plan held for Plus.
    val chapter: KeyedResources<ChapterKey, GoalChapter> =
        cache.keyed(Audience.SignedIn, PlanStore.PLAN_DOMAINS) { session, key -> session?.let { api.chapter(it, key) } }

    /** Extra practice on a chapter, opened where its block plays; null when the session changed meanwhile. */
    suspend fun practice(key: ChapterKey): PracticeOutcome? =
        when (
            val result =
                cache.mutate(invalidating = setOf(DataDomain.UserProgress)) { session ->
                    api.practiceArea(session, key.goalId, AreaPracticeInput(areaId = key.chapterId.toString(), timeZone = timeZone().id))
                }
        ) {
            is MutationResult.Done -> {
                PracticeOutcome.Opened(result.value.route)
            }

            is MutationResult.Failed -> {
                when (result.code) {
                    EXTRA_TIME_UNAVAILABLE -> PracticeOutcome.DailyCap
                    NOTHING_TO_PRACTICE -> PracticeOutcome.NothingToPractice
                    else -> PracticeOutcome.Failed
                }
            }

            MutationResult.Obsolete -> {
                null
            }
        }

    private companion object {
        const val EXTRA_TIME_UNAVAILABLE = "EXTRA_TIME_UNAVAILABLE"
        const val NOTHING_TO_PRACTICE = "NOTHING_TO_PRACTICE"
    }
}

/** A lesson block opens its lesson, which waits while it's written; any other block plays in the session. */
private val AreaPractice.route: AppRoute
    get() {
        val lessonId = block.lessonId
        return when {
            block.kind != StudyBlock.Kind.LEARN -> AppRoute.QuestionBlock(sessionId = sessionId.toString(), blockId = block.id.toString())
            lessonId != null -> AppRoute.Lesson(lessonId = lessonId.toString(), sessionId = sessionId.toString())
            else -> AppRoute.Session(blockId = block.id.toString())
        }
    }
