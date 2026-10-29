package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.api.apis.MistakesApi
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.MemoryInsightAnswer
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.MockOptions
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

    override suspend fun brainPower(session: AuthenticatedSession): Long? =
        perform { api.clients(session).progress.getCurrentUserLevel() }.level?.totalBrainPower

    override suspend fun mistakes(
        session: AuthenticatedSession,
        goalId: UUID,
    ): MistakeListAvailability =
        perform {
            api
                .clients(
                    session,
                ).mistakes
                .listCurrentUserMistakes(goalId = goalId, limit = 1, status = MistakesApi.StatusListCurrentUserMistakes.OPEN)
        }.availability

    override suspend fun mocks(
        session: AuthenticatedSession,
        goalId: UUID,
    ): MockOptions = perform { api.clients(session).exams.listMocks(goalId) }

    override suspend fun language(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageToday = perform { api.clients(session).language.getLanguageToday(goalId) }

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

    override suspend fun answerInsight(
        session: AuthenticatedSession,
        insightId: UUID,
        accepted: Boolean,
    ) {
        val status = if (accepted) MemoryInsightAnswer.Status.ACCEPTED else MemoryInsightAnswer.Status.DISMISSED
        perform { api.clients(session).memory.answerMemoryInsight(insightId, MemoryInsightAnswer(status)) }
    }

    override suspend fun prepareLessons(
        session: AuthenticatedSession,
        goalId: UUID,
    ) {
        perform { api.clients(session).contentGeneration.createGoalLessonPreparation(goalId) }
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
