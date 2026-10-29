package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalDraft
import com.zoonk.api.models.PlanLinkStartInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    private fun limit(
        period: String,
        resource: String,
        tier: String,
    ): JsonObject =
        buildJsonObject {
            put("period", period)
            put("resource", resource)
            put("tier", tier)
        }

    @Test
    fun aVisitorsGoalStartsAGuestThenIsSentAsThatGuest() =
        runTest {
            val session = FakeSession(null)
            val api = FakeOnboardingApi()
            val store =
                OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))), session) {
                    session.session = ana
                    true
                }

            val outcome = store.sendGoal("pass the bar exam", "pt")

            assertTrue(outcome is WriteOutcome.Done)
            assertEquals(listOf(ana), api.sessions)
            assertEquals(listOf("pass the bar exam" to "pt"), api.understandCalls)
            assertTrue(store.drafts[DRAFT_ID].state.value is LoadState.Loaded)
            assertTrue(store.wasSentHere(DRAFT_ID))
        }

    @Test
    fun aGuestThatCouldntStartSendsNothing() =
        runTest {
            val session = FakeSession(null)
            val api = FakeOnboardingApi()
            val store =
                OnboardingStore(
                    api,
                    AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))),
                    session,
                ) { false }

            assertEquals(WriteOutcome.Failed, store.sendGoal("pass the bar exam", "en"))
            assertTrue(api.understandCalls.isEmpty())
        }

    @Test
    fun limitsSayWhatRanOutAndWhen() =
        runTest {
            val session = FakeSession(ana)
            val api = FakeOnboardingApi()
            val store =
                OnboardingStore(
                    api,
                    AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))),
                    session,
                ) { true }

            api.refusal =
                ApiException(
                    ApiError.Unavailable,
                    "USAGE_LIMIT_REACHED",
                    details =
                        buildJsonObject {
                            putJsonObject("limit") {
                                put("period", "month")
                                put("resource", "smallAi")
                                put("tier", "free")
                            }
                        },
                )
            val read = store.sendGoal("pass the bar exam", "en")
            assertEquals(GoalError.ReadLimit(UsageLimit("month", "smallAi", "free")), read.startError())

            api.refusal =
                ApiException(
                    ApiError.Unavailable,
                    "USAGE_LIMIT_REACHED",
                    details = buildJsonObject { put("limit", limit("total", "goal", "guest")) },
                )
            assertEquals(GoalError.Limit(GoalLimitReason.Guest), store.sendGoal("x", "en").startError())

            api.refusal =
                ApiException(ApiError.Unavailable, "GOAL_LIMIT_REACHED", status = 429, details = limit("total", "activeGoals", "free"))
            val created =
                store.createGoals(
                    GoalCreateInput(dailyMinutes = 15, goals = emptyList()),
                )
            assertEquals(GoalLimitReason.OneActiveGoal, (created as WriteOutcome.Refused).refusal.goalLimitReason())

            api.refusal = ApiException(ApiError.Unavailable, "SLOW_DOWN", status = 429)
            assertEquals(GoalError.OneMoment, store.sendGoal("x", "en").startError())

            api.refusal = ApiException(ApiError.Unavailable, status = 429)
            assertEquals(GoalError.OneMoment, store.sendGoal("x", "en").startError())

            api.refusal = ApiException(ApiError.Unavailable, "INTERNAL_ERROR", status = 500)
            assertEquals(WriteOutcome.Failed, store.sendGoal("x", "en"))
        }

    @Test
    fun theFirstCapANewGoalWouldHitIsSaidBeforeTyping() {
        fun allowance(
            tier: String,
            goal: String,
            activeGoals: String = """{"limit":null,"used":0}""",
        ): AllowanceResponse =
            ApiJson.decodeFromString(
                """
                {"tier":"$tier","activeGoals":$activeGoals,"callTime":{"limitSeconds":null,"monthLimitSeconds":null,"usedSeconds":0,"usedSecondsThisMonth":0},
                 "examPrep":{"includesMockExams":false,"studyDays":null},"generatedLessons":null,"resets":{"day":"2026-10-29T00:00:00Z","month":"2026-11-01T00:00:00Z"},
                 "items":[{"kind":"goal",$goal,"fairUseDailyLimit":null,"remaining":null}]}
                """.trimIndent(),
            )
        val room = """"dailyLimit":null,"monthlyLimit":3,"totalLimit":null,"usedToday":0,"usedThisMonth":1,"usedTotal":1"""

        assertNull(allowance("free", room).goalStartLimit())
        assertEquals(
            GoalLimitReason.Guest,
            allowance(
                "guest",
                """"dailyLimit":null,"monthlyLimit":null,"totalLimit":1,"usedToday":1,"usedThisMonth":1,"usedTotal":1""",
            ).goalStartLimit(),
        )
        assertEquals(
            GoalLimitReason.MonthlyGoals,
            allowance(
                "free",
                """"dailyLimit":null,"monthlyLimit":3,"totalLimit":null,"usedToday":1,"usedThisMonth":3,"usedTotal":3""",
            ).goalStartLimit(),
        )
        assertEquals(GoalLimitReason.OneActiveGoal, allowance("free", room, """{"limit":1,"used":1}""").goalStartLimit())
        assertFalse(GoalLimitReason.DailyGoals.isPlusLimit)
    }

    @Test
    fun aGoalFromASharedPlanFollowsThatPlan() =
        runTest {
            val session = FakeSession(ana)
            val api = FakeOnboardingApi()
            val store =
                OnboardingStore(
                    api,
                    AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))),
                    session,
                ) { true }
            val input =
                GoalCreateInput(
                    dailyMinutes = 20,
                    goals =
                        listOf(
                            GoalDraft(kind = GoalDraft.Kind.EXAM, language = "en", prompt = "pass the bar", title = "Pass the bar exam"),
                        ),
                    studyTime = "07:00",
                )

            assertEquals(WriteOutcome.Done(GOAL_ID), store.createGoals(input, planId = "plan-1"))

            val (planId, start) = api.fromPlans.single()
            assertEquals("plan-1", planId)
            assertEquals(PlanLinkStartInput(dailyMinutes = 20, studyTime = "07:00", title = "Pass the bar exam"), start)
            assertTrue(api.created.isEmpty())
        }
}
