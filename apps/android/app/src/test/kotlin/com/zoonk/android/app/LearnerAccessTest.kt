package com.zoonk.android.app

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.account
import com.zoonk.android.data.summary
import com.zoonk.android.navigation.LearnerAccess
import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

class LearnerAccessTest {
    private val signedIn = SessionState.SignedIn(AuthenticatedSession(ANA, "token", "local"), account(ANA), isGuest = false)
    private val noGoals = summary(readAt = 0, nextChangeAt = 0)

    private fun goal(
        kind: LearnerSummaryGoal.Kind,
        status: LearnerSummaryGoal.Status = LearnerSummaryGoal.Status.ACTIVE,
    ) = LearnerSummaryGoal(
        courseId = null,
        dailyMinutes = 20,
        id = UUID.randomUUID(),
        isActive = true,
        kind = kind,
        status = status,
        targetDate = null,
        targetLanguage = null,
        title = "Goal",
    )

    @Test
    fun theSessionDecidesBeforeTheSummaryIsRead() {
        assertEquals(LearnerAccess.Restoring, learnerAccess(SessionState.Restoring, LoadState.Idle))
        assertEquals(LearnerAccess.Unavailable, learnerAccess(SessionState.Unavailable, LoadState.Idle))
        assertEquals(LearnerAccess.Visitor, learnerAccess(SessionState.SignedOut(), LoadState.Idle))
        assertEquals(LearnerAccess.SessionEnded, learnerAccess(SessionState.SignedOut(sessionEnded = true), LoadState.Idle))
        assertEquals(LearnerAccess.SignedIn, learnerAccess(signedIn, LoadState.Loading))
    }

    @Test
    fun onlyAFollowedGoalMakesALearner() {
        assertEquals(LearnerAccess.NoGoal, learnerAccess(signedIn, LoadState.Loaded(noGoals)))
        val explanationsAndArchived =
            noGoals.copy(
                goals =
                    listOf(
                        goal(LearnerSummaryGoal.Kind.EXPLAIN),
                        goal(LearnerSummaryGoal.Kind.LEARN, LearnerSummaryGoal.Status.ARCHIVED),
                    ),
            )
        assertEquals(LearnerAccess.NoGoal, learnerAccess(signedIn, LoadState.Loaded(explanationsAndArchived)))
        assertEquals(
            LearnerAccess.Learner,
            learnerAccess(signedIn, LoadState.Loaded(noGoals.copy(goals = listOf(goal(LearnerSummaryGoal.Kind.EXAM))))),
        )
    }
}
