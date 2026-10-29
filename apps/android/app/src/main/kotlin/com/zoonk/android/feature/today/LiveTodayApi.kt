package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.SuggestedGoalAnswer
import com.zoonk.api.models.Today
import java.util.UUID

class LiveTodayApi(
    private val api: ApiClients,
) : TodayApi {
    override suspend fun today(
        session: AuthenticatedSession,
        timeZone: String,
    ): Today = perform { api.clients(session).studySessions.getToday(timeZone = timeZone) }

    override suspend fun resumePreview(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Boolean = perform { api.clients(session).plans.previewGoalResume(goalId) }

    override suspend fun onboardingLeft(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Boolean = perform { api.clients(session).onboarding.getOnboarding(goalId) }.steps.any { it != OnboardingStep.PLAN }

    override suspend fun resume(
        session: AuthenticatedSession,
        goalId: UUID,
    ) {
        perform { api.clients(session).goals.updateGoal(goalId, GoalUpdateInput(status = GoalUpdateInput.Status.ACTIVE)) }
    }

    override suspend fun answerSuggestedGoal(
        session: AuthenticatedSession,
        suggestionId: UUID,
        accepted: Boolean,
    ): SuggestedGoal {
        val status = if (accepted) SuggestedGoalAnswer.Status.ACCEPTED else SuggestedGoalAnswer.Status.DISMISSED
        return perform { api.clients(session).studySessions.answerSuggestedGoal(suggestionId, SuggestedGoalAnswer(status)) }.suggestedGoal
    }
}
