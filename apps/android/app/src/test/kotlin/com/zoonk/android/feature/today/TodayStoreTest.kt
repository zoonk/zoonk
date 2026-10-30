package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.models.LessonGenerationStatus
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

class TodayStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goal = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d11")

    private fun api(answer: suspend () -> Today) =
        object : TodayApi {
            override suspend fun today(
                session: AuthenticatedSession,
                timeZone: String,
            ) = answer()

            override suspend fun todayChanged(
                session: AuthenticatedSession,
                goalId: UUID,
                since: Instant,
            ) = false

            override suspend fun brainPower(session: AuthenticatedSession): Long? = null

            override suspend fun mistakes(
                session: AuthenticatedSession,
                goalId: UUID,
            ) = com.zoonk.api.models
                .MistakeListAvailability(ready = 0, tomorrow = 0)

            override suspend fun language(
                session: AuthenticatedSession,
                goalId: UUID,
            ): com.zoonk.api.models.LanguageToday = error("Not used")

            override suspend fun resumePreview(
                session: AuthenticatedSession,
                goalId: UUID,
            ) = false

            override suspend fun onboardingLeft(
                session: AuthenticatedSession,
                goalId: UUID,
            ) = false

            override suspend fun resume(
                session: AuthenticatedSession,
                goalId: UUID,
            ) = Unit

            override suspend fun answerInsight(
                session: AuthenticatedSession,
                insightId: UUID,
                accepted: Boolean,
            ) = Unit

            override suspend fun prepareLessons(
                session: AuthenticatedSession,
                goalId: UUID,
            ) = error("Not used")

            override suspend fun answerSuggestedGoal(
                session: AuthenticatedSession,
                suggestionId: UUID,
                accepted: Boolean,
            ): SuggestedGoal = error("Not used")
        }

    @Test
    fun aDayNotOpenedYetReadsWithoutIdsAndKeepsEachLessonsStatus() =
        runTest {
            val lesson = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d21"
            val block = fixture("unstarted-study-day-blocks-inner", "kind" to "learn", "lessonId" to lesson, "position" to 2)
            val session =
                fixture(
                    "unstarted-study-day",
                    "blocks" to kotlinx.serialization.json.JsonArray(listOf(block)),
                    "nextPosition" to 2,
                    "state" to "underway",
                )
            val today = decodeFixture<Today>("today", "session" to session, "lessonStatus" to buildJsonObject { put(lesson, "generating") })

            val read = read(api { today }, ana, "UTC") as TodayRead.Day

            assertNull(read.day.sessionId)
            assertNull(
                read.day.steps
                    .single()
                    .id,
            )
            assertEquals(LessonGenerationStatus.GENERATING, read.today.lessonStatus[lesson])
            assertEquals(true, read.day.isWaitingForLessons(read.today.lessonStatus))
        }

    @Test
    fun anEmptyDayNobodyIsWritingAsksForItsLessons() =
        runTest {
            val session =
                fixture(
                    "unstarted-study-day",
                    "blocks" to kotlinx.serialization.json.JsonArray(emptyList()),
                    "emptyDay" to "lessonsToPrepare",
                    "minutes" to
                        buildJsonObject {
                            put("dailyGoal", 30)
                            put("done", 0)
                            put("planned", 0)
                        },
                    "nextPosition" to null,
                    "state" to "prepare",
                )
            val today = decodeFixture<Today>("today", "session" to session)

            val read = read(api { today }, ana, "UTC") as TodayRead.Day

            assertEquals(StudySession.State.PREPARE, read.day.state)
        }

    @Test
    fun noActiveGoalOffersTheSuggestedGoalFromTheErrorsDetails() =
        runTest {
            val suggestion = fixture("suggested-goal", "title" to "Spanish")
            val details = JsonObject(mapOf("suggestedGoal" to suggestion))

            val read = read(api { throw ApiException(ApiError.NotFound, "NO_ACTIVE_GOAL", details = details) }, ana, "UTC")

            assertEquals("Spanish", (read as TodayRead.NoGoal).suggestedGoal?.title)
        }

    @Test
    fun aPlanStillBeingBuiltNamesItsGoalAndAnInactiveGoalSaysSo() =
        runTest {
            val details =
                buildJsonObject {
                    put(
                        "goal",
                        buildJsonObject {
                            put("id", goal.toString())
                            put("title", "Biology")
                        },
                    )
                }

            assertEquals(
                TodayRead.Preparing(goal, "Biology"),
                read(
                    api {
                        throw ApiException(ApiError.Unavailable, "PLAN_NOT_READY", details = details)
                    },
                    ana,
                    "UTC",
                ),
            )
            assertEquals(TodayRead.GoalNotActive, read(api { throw ApiException(ApiError.Unavailable, "GOAL_NOT_ACTIVE") }, ana, "UTC"))
        }

    @Test
    fun aPollReadsTheDayAgainOnlyWhenItChangedSinceAMinuteBeforeTheLastRead() =
        runTest {
            val api = FakeTodayApi(listOf(decodeFixture<Today>("today")))
            val store = TodayStore(api, AppCache(FakeSession(ana), backgroundScope), backgroundScope, { "UTC" }, now = { READ_AT })
            store.today.refresh()
            store.refreshIfChanged()

            assertFalse(store.refreshIfChanged())
            assertEquals(1, api.reads)
            assertEquals(List(2) { Instant.fromEpochMilliseconds(READ_AT) - 1.minutes }, api.asked)

            api.changed = true
            assertTrue(store.refreshIfChanged())
            assertEquals(2, api.reads)
        }

    @Test
    fun aReadOutsideThePollStillCountsAsReadingTheDayAgain() =
        runTest {
            val api = FakeTodayApi(listOf(decodeFixture<Today>("today")))
            val store = TodayStore(api, AppCache(FakeSession(ana), backgroundScope), backgroundScope, { "UTC" }, now = { READ_AT })
            store.today.refresh()
            store.refreshIfChanged()

            store.today.refresh()

            assertTrue(store.refreshIfChanged())
            assertFalse(store.refreshIfChanged())
        }

    private companion object {
        const val READ_AT = 1_800_000_000_000L
    }
}
