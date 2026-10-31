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
import com.zoonk.api.ApiJson
import com.zoonk.api.ApiRequestJson
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockOpening
import com.zoonk.api.models.StudyBlockOpeningTarget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StudyOpenerTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    private fun TestScope.opener(api: FakeStudyApi): StudyOpener {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return StudyOpener(api, api::writeLesson, AppCache(FakeSession(ana), scope), timeZone = { "America/Sao_Paulo" })
    }

    private fun sent(target: StudyBlockOpeningTarget): JsonObject =
        ApiRequestJson.encodeToJsonElement(StudyBlockOpeningTarget.serializer(), target).jsonObject

    private fun target(
        kind: String,
        vararg fields: Pair<String, Any?>,
    ): JsonObject = opening(kind, *fields)

    @Test
    fun continueOnASavedDayNamesTheShownStepAndOpensTheLessonTheServerStarted() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(opening("lesson", "lessonId" to LESSON, "sessionId" to SESSION.toString()))
            val lesson = step(0)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = true, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(LESSON, SESSION.toString())), result)
            assertEquals(
                listOf(target("next", "expectedBlockId" to blockId(0).toString(), "sessionId" to SESSION.toString())),
                api.targets.map(::sent),
            )
            assertEquals(emptyList<OpenStudyDayRequest>(), api.opened)
            assertEquals(emptyList<String>(), api.written)
        }

    @Test
    fun aTapOnASavedReviewOpensItsQuestionsInTheDaysSession() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(opening("session", "blockId" to blockId(0).toString()))
            val review = step(0, kind = StudyBlock.Kind.REVIEW, screen = StudyBlock.Screen.SESSION, lessonId = null)

            val result = opener(api).open(day(listOf(review)), review, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(SESSION.toString(), blockId(0).toString())), result)
            assertEquals(listOf(target("block", "blockId" to blockId(0).toString())), api.targets.map(::sent))
        }

    @Test
    fun eachOpeningShowsItsScreen() {
        val block = blockId(0).toString()
        val session = SESSION.toString()
        val planItem = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77"

        fun routeOf(opening: JsonObject) = ApiJson.decodeFromJsonElement(StudyBlockOpening.serializer(), opening).route(SESSION)

        assertEquals(AppRoute.Session(blockId = block, sessionId = session), routeOf(opening("preparingLesson", "blockId" to block)))
        assertEquals(AppRoute.Essay(block), routeOf(opening("essay", "blockId" to block)))
        assertEquals(AppRoute.Checkpoint(block, session), routeOf(opening("checkpoint", "blockId" to block, "sessionId" to session)))
        assertEquals(AppRoute.Mock(block, session), routeOf(opening("mock", "blockId" to block, "sessionId" to session)))
        assertEquals(AppRoute.Challenge(planItem, session), routeOf(opening("challenge", "planItemId" to planItem, "sessionId" to session)))
        assertEquals(AppRoute.Session(sessionId = session), routeOf(opening("session", "blockId" to null)))
        assertEquals(AppRoute.Session(blockId = block, sessionId = session), routeOf(unwritten()))
        assertEquals(AppRoute.Today, routeOf(opening("today")))
        assertEquals(null, routeOf(opening("changed")))
    }

    @Test
    fun anUnwrittenLessonsTapAsksToWriteItOnceAndTheSessionWaitsOnItsBlock() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(unwritten())
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Session(blockId = blockId(0).toString(), sessionId = SESSION.toString())), result)
            assertEquals(listOf(LESSON), api.written)
            assertEquals(1, api.targets.size)
        }

    @Test
    fun aLessonWrittenBeforeTheTapOpensItsBlockAgainWhichStartsIt() =
        runTest {
            val api = FakeStudyApi()
            api.generation = LessonGeneration(generationId = null, status = LessonGeneration.Status.READY)
            api.openings = listOf(unwritten(), opening("lesson", "lessonId" to LESSON, "sessionId" to SESSION.toString()))
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            val result = opener(api).open(day(listOf(lesson)), lesson, next = true, goalId = GOAL)

            assertEquals(MutationResult.Done(AppRoute.Lesson(LESSON, SESSION.toString())), result)
            assertEquals(target("block", "blockId" to blockId(0).toString()), sent(api.targets.last()))
        }

    @Test
    fun aRefusedWriteOpensTheSessionsStepWithWhyUntilAWriteGoesThrough() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(unwritten())
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
        }

    @Test
    fun aWriteThatFailsOrFindsNoLessonFailsTheTap() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(unwritten())
            val lesson = step(0, screen = StudyBlock.Screen.SESSION)

            api.writeError = ApiException(ApiError.NotFound, status = 404)
            assertTrue(opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL) is MutationResult.Failed)

            api.writeError = ApiException(ApiError.Network)
            assertTrue(opener(api).open(day(listOf(lesson)), lesson, next = false, goalId = GOAL) is MutationResult.Failed)
        }

    @Test
    fun aDayNotOpenedYetIsSavedWithTheShownWorkAndItsNullsThenFollowsItsOpening() =
        runTest {
            val api = FakeStudyApi()
            api.dayOpening = opening("session", "blockId" to blockId(0).toString())
            val review = step(0, kind = StudyBlock.Kind.REVIEW, screen = StudyBlock.Screen.SESSION, saved = false, lessonId = null)

            val result = opener(api).open(day(listOf(review), saved = false), review, next = true, goalId = GOAL)

            val opened = decodeFixture<OpenedStudyDay>("opened-study-day").sessionId
            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(opened.toString(), blockId(0).toString())), result)
            assertEquals(emptyList<StudyBlockOpeningTarget>(), api.targets)
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
    fun aDayWhoseTargetCantStartOpensNothing() =
        runTest {
            val api = FakeStudyApi()
            api.targetStatus = "changed"
            val lesson = step(0, saved = false)

            assertEquals(
                MutationResult.Done(null),
                opener(api).open(day(listOf(lesson), saved = false), lesson, next = false, goalId = GOAL),
            )
        }

    @Test
    fun anOpenThatLostARaceWithAPlanChangeIsSentOnceMoreOnItsOwn() =
        runTest {
            val api = FakeStudyApi()
            val retryable = ApiException(ApiError.Unavailable, "STUDY_DAY_RETRYABLE", status = 409)
            val essay = step(0, kind = StudyBlock.Kind.PRODUCE, screen = StudyBlock.Screen.ESSAY, lessonId = null)
            api.openings = listOf(opening("essay", "blockId" to blockId(0).toString()))

            api.failures += retryable
            assertEquals(
                MutationResult.Done(AppRoute.Essay(blockId(0).toString())),
                opener(api).open(day(listOf(essay)), essay, next = false, goalId = GOAL),
            )
            assertEquals(2, api.targets.size)

            api.failures += listOf(retryable, retryable)
            assertTrue(opener(api).open(day(listOf(essay)), essay, next = false, goalId = GOAL) is MutationResult.Failed)
        }

    @Test
    fun aMissionOpensItsBlockOnlyWhileFreeAndOneGoneMeanwhileOpensNothing() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(opening("session", "blockId" to blockId(0).toString()))

            assertEquals(
                MutationResult.Done(AppRoute.QuestionBlock(SESSION.toString(), blockId(0).toString())),
                opener(api).openMission(blockId(0), SESSION),
            )
            assertEquals(target("mission", "blockId" to blockId(0).toString()), sent(api.targets.single()))

            api.openings = listOf(opening("changed"))
            assertEquals(MutationResult.Done(null), opener(api).openMission(blockId(0), SESSION))

            api.failures += ApiException(ApiError.NotFound, status = 404)
            assertEquals(MutationResult.Done(null), opener(api).openMission(blockId(0), SESSION))
        }

    @Test
    fun extraTimeKeepsADayNotOpenedYetThenOpensTheBlockItAdded() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(opening("session", "blockId" to FakeStudyApi.EXTRA_BLOCK.toString()))
            val opened = decodeFixture<OpenedStudyDay>("opened-study-day").sessionId

            val result = opener(api).addExtraTime(day(saved = false), GOAL)

            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(opened.toString(), FakeStudyApi.EXTRA_BLOCK.toString())), result)
            assertEquals(true, api.opened.single().keepEmpty)
            assertEquals(listOf(opened), api.added)
            assertEquals(target("block", "blockId" to FakeStudyApi.EXTRA_BLOCK.toString()), sent(api.targets.single()))
        }

    @Test
    fun continuingAtABlocksEndOpensTheSessionsNextStepWhateverItIs() =
        runTest {
            val api = FakeStudyApi()
            api.openings = listOf(opening("session", "blockId" to blockId(1).toString()))

            val result = opener(api).continueSession(SESSION)

            assertEquals(MutationResult.Done(AppRoute.QuestionBlock(SESSION.toString(), blockId(1).toString())), result)
            assertEquals(target("next", "sessionId" to SESSION.toString()), sent(api.targets.single()))
            assertEquals(0, api.sessionReads)
        }

    @Test
    fun continuingWithNothingLeftOpensTheSummaryAndAfterTheDayEndedGoesBackToToday() =
        runTest {
            val api = FakeStudyApi()

            api.openings = listOf(opening("session", "blockId" to null))
            assertEquals(MutationResult.Done(AppRoute.Session(sessionId = SESSION.toString())), opener(api).continueSession(SESSION))

            api.openings = listOf(opening("today"))
            assertEquals(MutationResult.Done(AppRoute.Today), opener(api).continueSession(SESSION))
        }

    @Test
    fun stoppingForTodayOpensTheSessionsStoppedSummary() =
        runTest {
            val api = FakeStudyApi()

            assertEquals(MutationResult.Done(AppRoute.Session(sessionId = SESSION.toString(), stopped = true)), opener(api).stop(SESSION))
            assertEquals(listOf(SESSION), api.stopped)
        }

    private fun unwritten() =
        opening("unwrittenLesson", "blockId" to blockId(0).toString(), "lessonId" to LESSON, "sessionId" to SESSION.toString())

    private companion object {
        val LESSON = step(0).lessonId.toString()
    }
}
