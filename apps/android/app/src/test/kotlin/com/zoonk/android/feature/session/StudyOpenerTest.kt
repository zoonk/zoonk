package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.player.LessonWriting
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.ApiRequestJson
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class StudyOpenerTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    private fun TestScope.opener(api: FakeStudyApi): StudyOpener {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return StudyOpener(api, api::writeLesson, AppCache(FakeSession(ana), scope), timeZone = { "America/Sao_Paulo" }, scope = scope)
    }

    @Test
    fun aSavedLessonStartsItsBlockAndOpensThePlayerWithTheSession() =
        runTest {
            val api = FakeStudyApi()
            val lesson = step(0)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = true, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(lesson.lessonId.toString(), SESSION.toString())), result)
            assertEquals(listOf(blockId(0)), api.started)
            assertEquals(emptyList<OpenStudyDayRequest>(), api.opened)
            assertEquals(emptyList<String>(), api.written)
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
    fun anUnwrittenLessonsTapAsksToWriteItOnceAndOpensItsPageToFollowTheWriting() =
        runTest {
            val api = FakeStudyApi()
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(lesson.lessonId.toString(), SESSION.toString())), result)
            assertEquals(listOf(lesson.lessonId.toString()), api.written)
            advanceUntilIdle()
            assertEquals(emptyList<UUID>(), api.started)
            assertEquals(emptyList<UUID>(), api.prepared)
        }

    @Test
    fun aLessonWrittenBeforeTheTapStartsItsBlockAndOpens() =
        runTest {
            val api = FakeStudyApi()
            api.generation = LessonGeneration(generationId = null, status = LessonGeneration.Status.READY)
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(lesson.lessonId.toString(), SESSION.toString())), result)
            assertEquals(listOf(blockId(0)), api.started)
        }

    @Test
    fun aRefusedWriteOpensTheSessionsStepWithWhyUntilAWriteGoesThrough() =
        runTest {
            val api = FakeStudyApi()
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)
            val opener = opener(api)
            val step = MutationResult.Done(AppRoute.Session(blockId = blockId(0).toString(), sessionId = SESSION.toString()))

            api.writeError = ApiException(ApiError.Unavailable, "PLUS_REQUIRED", status = 403)
            assertEquals(step, opener.open(day(listOf(lesson)), lesson, next = false, goalId = GOAL))
            assertEquals(LessonWriting.Refused(LessonRefusal.PlusRequired), opener.notWritten(blockId(0)))

            api.writeError = ApiException(ApiError.Unavailable, "LESSON_SET_ASIDE", status = 409)
            assertEquals(step, opener.open(day(listOf(lesson)), lesson, next = false, goalId = GOAL))
            assertEquals(LessonWriting.SetAside, opener.notWritten(blockId(0)))

            api.writeError = ApiException(ApiError.Unavailable, "SLOW_DOWN", status = 429)
            assertEquals(step, opener.open(day(listOf(lesson)), lesson, next = false, goalId = GOAL))
            assertEquals(LessonWriting.Refused(LessonRefusal.Limited(Limit.SlowDown(60))), opener.notWritten(blockId(0)))

            api.writeError = null
            opener.open(day(listOf(lesson)), lesson, next = false, goalId = GOAL)
            assertEquals(null, opener.notWritten(blockId(0)))
            assertEquals(emptyList<UUID>(), api.started)
        }

    @Test
    fun aWriteThatFailsOrFindsNoLessonFailsTheTap() =
        runTest {
            val api = FakeStudyApi()
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            api.writeError = ApiException(ApiError.NotFound, status = 404)
            assertTrue(opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL) is MutationResult.Failed)

            api.writeError = ApiException(ApiError.Network)
            assertTrue(opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL) is MutationResult.Failed)
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
                ApiRequestJson
                    .encodeToJsonElement(OpenStudyDayRequest.serializer(), api.opened.single())
                    .jsonObject
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
            assertEquals(
                MutationResult.Done(AppRoute.Session(sessionId = SESSION.toString())),
                opener(api).open(day(listOf(essay)), essay, next = false, goalId = GOAL),
            )

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

    @Test
    fun onlyAnOpenWithoutAStartPreparesTheSessionSinceAStartPreparesItOnTheServer() =
        runTest {
            val lesson = step(0)
            val review = step(1, kind = StudyBlock.Kind.REVIEW, screen = StudyBlock.Screen.SESSION, lessonId = null)
            val challenge =
                step(
                    2,
                    kind = StudyBlock.Kind.CHECKPOINT,
                    screen = StudyBlock.Screen.CHALLENGE,
                    lessonId = null,
                    planItemId = UUID.randomUUID(),
                )
            val unpicked = step(3, screen = StudyBlock.Screen.SESSION, lessonId = null)
            val day = day(listOf(lesson, review, challenge, unpicked))

            suspend fun preparedFor(step: DayStep): List<UUID> {
                val api = FakeStudyApi()
                opener(api).open(day, step, next = false, goalId = GOAL)
                advanceUntilIdle()
                return api.prepared
            }

            assertEquals(emptyList<UUID>(), preparedFor(lesson))
            assertEquals(emptyList<UUID>(), preparedFor(review))
            assertEquals(listOf(SESSION), preparedFor(challenge))
            assertEquals(listOf(SESSION), preparedFor(unpicked))
        }

    @Test
    fun continuingOpensTheDayFirstSoItStartsTheNextBlockTheQueueGainedSince() =
        runTest {
            val api = FakeStudyApi()
            api.session = decodeFixture("study-session", *studySession(next = null))
            api.openedSession = fixture("study-session", *studySession(next = blockId(1)))

            val result = opener(api).continueSession(SESSION)

            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(SESSION.toString(), blockId(1).toString())), result)
            assertEquals(1, api.opened.size)
            assertEquals(listOf(blockId(1)), api.started)
        }

    @Test
    fun continuingWithNothingLeftOpensTheSessionsSummary() =
        runTest {
            val api = FakeStudyApi()
            api.session = decodeFixture("study-session", *studySession(next = null))
            api.openedSession = fixture("study-session", *studySession(next = null))

            assertEquals(MutationResult.Done(AppRoute.Session(sessionId = SESSION.toString())), opener(api).continueSession(SESSION))
            assertEquals(emptyList<UUID>(), api.started)
        }

    @Test
    fun continuingAfterTheDayEndedOrWhenTheNextStepCantStartGoesBackToToday() =
        runTest {
            val api = FakeStudyApi()

            api.session = decodeFixture("study-session", *studySession(next = blockId(1), current = false))
            assertEquals(MutationResult.Done(AppRoute.Today), opener(api).continueSession(SESSION))
            assertEquals(emptyList<OpenStudyDayRequest>(), api.opened)

            api.session = decodeFixture("study-session", *studySession(next = blockId(1)))
            api.openedSession = fixture("study-session", *studySession(next = blockId(1)), "id" to UUID.randomUUID().toString())
            assertEquals(MutationResult.Done(AppRoute.Today), opener(api).continueSession(SESSION))

            api.openedSession = fixture("study-session", *studySession(next = blockId(1)))
            api.startError = "DAILY_LIMIT_REACHED"
            assertEquals(MutationResult.Done(AppRoute.Today), opener(api).continueSession(SESSION))
            assertEquals(emptyList<UUID>(), api.started)
        }

    @Test
    fun stoppingForTodayOpensTheSessionsStoppedSummary() =
        runTest {
            val api = FakeStudyApi()

            assertEquals(MutationResult.Done(AppRoute.Session(sessionId = SESSION.toString(), stopped = true)), opener(api).stop(SESSION))
            assertEquals(listOf(SESSION), api.stopped)
        }

    private fun studySession(
        next: UUID?,
        current: Boolean = true,
    ): Array<Pair<String, Any?>> =
        arrayOf(
            "id" to SESSION.toString(),
            "goalId" to GOAL.toString(),
            "current" to current,
            "nextBlockId" to next?.toString(),
            "blocks" to
                JsonArray(
                    listOf(
                        fixture("study-block", "id" to blockId(0).toString(), "position" to 0, "status" to "completed"),
                        fixture("study-block", "id" to blockId(1).toString(), "position" to 1),
                    ),
                ),
        )
}
