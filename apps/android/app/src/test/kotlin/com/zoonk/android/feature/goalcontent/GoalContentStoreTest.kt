package com.zoonk.android.feature.goalcontent

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.plan.PlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AreaPractice
import com.zoonk.api.models.AreaPracticeInput
import com.zoonk.api.models.GoalChapter
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChangeInput
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanOperation
import com.zoonk.api.models.PlanOperationOneOf7
import com.zoonk.api.models.Syllabus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class GoalContentStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val key = ChapterKey(UUID.fromString(GOAL), UUID.fromString(chapterId(3)))

    @Test
    fun practiceOpensAQuestionBlockInTheSession() =
        runTest {
            val api = FakeGoalContentApi()

            val outcome = stores(api).first.practice(key)

            assertEquals(PracticeOutcome.Opened(AppRoute.QuestionBlock(sessionId = SESSION, blockId = BLOCK)), outcome)
            assertEquals(AreaPracticeInput(areaId = chapterId(3), timeZone = "America/Sao_Paulo"), api.practiced.single())
        }

    @Test
    fun practiceThatBringsALessonOpensThatLesson() =
        runTest {
            val api = FakeGoalContentApi().apply { practice = { practiceBlock("learn", lessonId = lessonId(4)) } }

            val outcome = stores(api).first.practice(key)

            assertEquals(PracticeOutcome.Opened(AppRoute.Lesson(lessonId = lessonId(4), sessionId = SESSION)), outcome)
        }

    @Test
    fun aLessonNotPickedYetOpensTheSessionAtItsBlock() =
        runTest {
            val api = FakeGoalContentApi().apply { practice = { practiceBlock("learn") } }

            assertEquals(PracticeOutcome.Opened(AppRoute.Session(blockId = BLOCK)), stores(api).first.practice(key))
        }

    @Test
    fun practiceRefusalsSayWhy() =
        runTest {
            val api = FakeGoalContentApi()
            val store = stores(api).first

            api.practice = { throw ApiException(ApiError.Unavailable, code = "CONFLICT", status = 409) }
            assertEquals(PracticeOutcome.DailyCap, store.practice(key))

            api.practice = { throw ApiException(ApiError.Unavailable, code = "UNPROCESSABLE", status = 422) }
            assertEquals(PracticeOutcome.NothingToPractice, store.practice(key))

            api.practice = { throw ApiException(ApiError.Unavailable, status = 500) }
            assertEquals(PracticeOutcome.Failed, store.practice(key))
        }

    @Test
    fun practiceAfterTheSessionEndedChangesNothing() =
        runTest {
            val api = FakeGoalContentApi().apply { practice = { throw ApiException(ApiError.Unauthorized, status = 401) } }

            assertNull(stores(api).first.practice(key))
        }

    @Test
    fun practiceRefreshesTheChapterShown() =
        runTest {
            val api = FakeGoalContentApi()
            val store = stores(api).first
            val shown = launch { store.chapter[key].shown.collect {} }
            advanceUntilIdle()

            store.practice(key)
            advanceUntilIdle()

            assertEquals(2, api.chapters)
            shown.cancel()
        }

    @Test
    fun aPlanChangeSendsTheDevicesTimeZoneAndReadsTheSyllabusAgain() =
        runTest {
            val api = FakeGoalContentApi()
            val planApi = FakePlanApi()
            val (store, plans) = stores(api, planApi)
            val syllabus = plans.syllabus[key.goalId]
            val shown = launch { syllabus.shown.collect {} }
            advanceUntilIdle()

            val restore =
                PlanOperation.PlanOperationOneOf7Value(
                    PlanOperationOneOf7(listOf("Spanish"), PlanOperationOneOf7.Kind.RESTORE_AREAS),
                )
            val result = store.changePlan(key.goalId, listOf(restore))
            advanceUntilIdle()

            assertEquals(true, result is MutationResult.Done)
            assertEquals(PlanChangeInput(operations = listOf(restore), timeZone = "America/Sao_Paulo"), api.changes.single())
            assertEquals(2, planApi.syllabi)
            shown.cancel()
        }

    private fun TestScope.stores(
        api: GoalContentApi,
        planApi: PlanApi = FakePlanApi(),
    ): Pair<GoalContentStore, PlanStore> {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val cache = AppCache(FakeSession(ana), scope)
        return GoalContentStore(api, cache, timeZone = { TimeZone.of("America/Sao_Paulo") }) to PlanStore(planApi, cache)
    }
}
