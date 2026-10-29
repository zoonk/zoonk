package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class StudyOpenerTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    private class FakeStudyApi : StudyApi {
        val opened = mutableListOf<JsonObject>()
        val started = mutableListOf<UUID>()
        val prepared = mutableListOf<UUID>()
        var target: JsonObject? = null
        var targetStatus = "resolved"
        var startError: String? = null

        override suspend fun openDay(
            session: AuthenticatedSession,
            goalId: UUID,
            body: JsonObject,
        ): OpenedStudyDay {
            opened += body
            return decodeFixture(
                "opened-study-day",
                "session" to fixture("study-session"),
                "target" to target,
                "targetStatus" to targetStatus,
            )
        }

        override suspend fun addExtraBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
        ): StudyBlock = error("Not used")

        override suspend fun catchUp(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ) = Unit

        override suspend fun startBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
            blockId: UUID,
            timeZone: String,
        ) {
            startError?.let { throw ApiException(ApiError.Unavailable, it) }
            started += blockId
        }

        override suspend fun prepare(
            session: AuthenticatedSession,
            sessionId: UUID,
        ) {
            prepared += sessionId
        }
    }

    private fun TestScope.opener(api: StudyApi): StudyOpener {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return StudyOpener(api, AppCache(FakeSession(ana), scope), timeZone = { "America/Sao_Paulo" }, scope = scope)
    }

    @Test
    fun aSavedLessonStartsItsBlockAndOpensThePlayerWithTheSession() =
        runTest {
            val api = FakeStudyApi()
            val lesson = step(0)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = true, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(lesson.lessonId.toString(), SESSION.toString())), result)
            assertEquals(listOf(blockId(0)), api.started)
            assertEquals(emptyList<JsonObject>(), api.opened)
            advanceUntilIdle()
            assertEquals(listOf(SESSION), api.prepared)
        }

    @Test
    fun aSavedReviewStartsItsBlockAndOpensTheQuestionRunner() =
        runTest {
            val api = FakeStudyApi()
            val review = step(0, kind = StudyBlock.Kind.REVIEW, screen = StudyBlock.Screen.SESSION, lessonId = null)

            val result = opener(api).open(day(listOf(review)), review, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(SESSION.toString(), blockId(0).toString())), result)
            assertEquals(listOf(blockId(0)), api.started)
        }

    @Test
    fun aLessonStillBeingWrittenOpensItsWaitWithoutStartingOrPreparing() =
        runTest {
            val api = FakeStudyApi()
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(lesson.lessonId.toString(), SESSION.toString())), result)
            advanceUntilIdle()
            assertEquals(emptyList<UUID>(), api.started)
            assertEquals(emptyList<UUID>(), api.prepared)
        }

    @Test
    fun aDayNotOpenedYetIsSavedWithTheShownWorkAndItsNullsThenOpensWhereTheSavedBlockPlays() =
        runTest {
            val api = FakeStudyApi()
            api.target = fixture("study-block", "id" to blockId(0).toString(), "kind" to "review", "screen" to "session", "position" to 0)
            val review = step(0, kind = StudyBlock.Kind.REVIEW, screen = StudyBlock.Screen.SESSION, saved = false, lessonId = null)

            val result = opener(api).open(day(listOf(review), saved = false), review, next = true, goalId = GOAL)

            val opened = decodeFixture<OpenedStudyDay>("opened-study-day").sessionId
            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(opened.toString(), blockId(0).toString())), result)
            val target =
                api.opened
                    .single()
                    .getValue("target")
                    .jsonObject
            assertEquals("next", target.getValue("kind").toString().trim('"'))
            val shown = target.getValue("shown").jsonObject
            assertEquals(JsonNull, shown.getValue("lessonId"))
            assertEquals(JsonNull, shown.getValue("checkpoint"))
            assertEquals(JsonNull, shown.getValue("areaId"))
        }

    @Test
    fun aDayThatChangedMeanwhileOpensNothing() =
        runTest {
            val api = FakeStudyApi()
            api.target = fixture("study-block")
            api.targetStatus = "changed"
            val lesson = step(0, saved = false)

            assertEquals(
                MutationResult.Done(null),
                opener(api).open(day(listOf(lesson), saved = false), lesson, next = false, goalId = GOAL),
            )
        }

    @Test
    fun aBlockFinishedElsewhereOpensTheSessionAndTheDailyLimitOpensNothing() =
        runTest {
            val api = FakeStudyApi()
            val essay = step(0, kind = StudyBlock.Kind.PRODUCE, screen = StudyBlock.Screen.ESSAY, lessonId = null)

            api.startError = "BLOCK_FINISHED"
            assertEquals(MutationResult.Done(AppRoute.Session()), opener(api).open(day(listOf(essay)), essay, next = false, goalId = GOAL))

            api.startError = "DAILY_LIMIT_REACHED"
            assertEquals(MutationResult.Done(null), opener(api).open(day(listOf(essay)), essay, next = false, goalId = GOAL))
        }

    @Test
    fun aChallengeNotBegunOpensItsIntroWhichStartsIt() =
        runTest {
            val api = FakeStudyApi()
            val planItem = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77")
            val challenge =
                step(0, kind = StudyBlock.Kind.CHECKPOINT, screen = StudyBlock.Screen.CHALLENGE, lessonId = null, planItemId = planItem)

            val result = opener(api).open(day(listOf(challenge)), challenge, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Challenge(planItem.toString(), SESSION.toString())), result)
            assertEquals(emptyList<UUID>(), api.started)
        }
}
