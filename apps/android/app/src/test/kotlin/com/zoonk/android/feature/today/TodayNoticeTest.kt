package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.Today
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

class TodayNoticeTest {
    private val changeId = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d31"

    private fun pick(
        vararg today: Pair<String, Any?>,
        session: JsonObject = fixture("study-session"),
        host: HostNotices = HostNotices(),
    ): TodayNoticeKind? {
        val read = decodeFixture<Today>("today", "session" to session, *today)
        return pickTodayNotice(read, read.session.toDayView(), host)
    }

    private fun planChange(
        status: String,
        behind: JsonObject? = null,
    ) = fixture("plan-change", "id" to changeId, "status" to status, "behind" to behind)

    @Test
    fun theExamDayGoesBeforeAProposedPlanChange() {
        assertEquals(
            TodayNoticeKind.Exam,
            pick("exam" to fixture("exam-moment", "stage" to "examDay"), "planChange" to planChange("proposed")),
        )
    }

    @Test
    fun anEndedFreeWeekGoesBeforeAProposedPlanChange() {
        val trialEnded =
            fixture(
                "study-session",
                "examAccess" to
                    buildJsonObject {
                        put("includesMockExams", false)
                        put("trialEnded", true)
                    },
            )

        assertEquals(TodayNoticeKind.ExamAccess, pick("planChange" to planChange("proposed"), session = trialEnded))
    }

    @Test
    fun aReportedResultStopsAskingHowItWent() {
        assertNull(pick("exam" to fixture("exam-moment", "stage" to "afterExam", "resultReported" to true)))
    }

    @Test
    fun aChangeTheInsightCarriesIsAnsweredOnTheInsight() {
        val insight =
            fixture(
                "memory-insight",
                "kind" to "planChange",
                "planChange" to
                    buildJsonObject {
                        put("canApply", true)
                        put("effect", null as String?)
                        put("id", changeId)
                        put("status", "proposed")
                    },
            )

        assertEquals(TodayNoticeKind.Insight, pick("insight" to insight, "planChange" to planChange("proposed")))
    }

    @Test
    fun anAppliedChangeTheLearnerFellBehindForAsksBeforeASourceChange() {
        val behind =
            buildJsonObject {
                put("canFocus", false)
                put("coveredAfter", 0.8)
                put("coveredBefore", 0.6)
                put("currentMinutes", 30)
                put("measure", "goal")
            }

        assertEquals(
            TodayNoticeKind.PlanChange,
            pick("planChange" to planChange("applied", behind), host = HostNotices(sourceChange = true)),
        )
        assertEquals(TodayNoticeKind.SourceChange, pick("planChange" to planChange("applied"), host = HostNotices(sourceChange = true)))
    }

    @Test
    fun aSuggestedGoalWaitsWhileTheDaysFreshStartSpeaks() {
        val suggestion = fixture("suggested-goal")

        assertNull(pick("suggestedGoal" to suggestion, session = fixture("study-session", "freshStart" to "welcomeBack")))
        assertEquals(TodayNoticeKind.SuggestedGoal, pick("suggestedGoal" to suggestion))
    }

    private val goal = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d41")
    private val day = LocalDate(2026, 10, 29)

    @Test
    fun theFirstPickHoldsForTheVisitWhileTodayMovesOn() {
        val hold = null.next(goal, day, TodayNoticeKind.Insight, insight = null)

        assertEquals(TodayNoticeKind.Insight, hold.next(goal, day, TodayNoticeKind.SuggestedGoal, insight = null).kind)
    }

    @Test
    fun anotherGoalOrANewDayIsANewVisit() {
        val hold = null.next(goal, day, TodayNoticeKind.SuggestedGoal, insight = null)

        assertEquals(TodayNoticeKind.Exam, hold.next(UUID.randomUUID(), day, TodayNoticeKind.Exam, insight = null).kind)
        assertNull(hold.next(goal, LocalDate(2026, 10, 30), picked = null, insight = null).kind)
    }

    @Test
    fun theAnsweredInsightStaysAfterTodayStopsCarryingIt() {
        val insight = decodeFixture<MemoryInsight>("memory-insight")
        val hold = null.next(goal, day, TodayNoticeKind.Insight, insight)

        assertEquals(insight, hold.next(goal, day, picked = null, insight = null).insight)
    }
}
