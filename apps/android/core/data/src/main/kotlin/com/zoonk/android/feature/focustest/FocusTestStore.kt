package com.zoonk.android.feature.focustest

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.android.feature.session.StudySessionStore
import com.zoonk.api.models.FocusTestControlsInput
import com.zoonk.api.models.FocusTestSummary
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import java.util.UUID

fun interface FocusTestApi {
    suspend fun update(
        session: AuthenticatedSession,
        goalId: UUID,
        input: FocusTestControlsInput,
    ): FocusTestSummary
}

class LiveFocusTestApi(
    private val api: ApiClients,
) : FocusTestApi {
    override suspend fun update(
        session: AuthenticatedSession,
        goalId: UUID,
        input: FocusTestControlsInput,
    ) = perform { api.clients(session).learner.updateGoalFocusTest(goalId, input) }
}

/**
 * The learner's switches on an exam goal's Focus test: its questions inside sessions and Today's
 * suggestion. The test itself (its sittings and answers) is the goal's placement.
 */
class FocusTestStore(
    private val api: FocusTestApi,
    private val cache: AppCache,
    private val sessions: StudySessionStore,
    private val summary: Resource<LearnerSummary>,
    private val timeZone: () -> String,
) {
    /** "Pause test questions" takes them out of today's session too, so its blocks are read again. */
    suspend fun setSessionQuestions(
        goalId: UUID,
        questions: FocusTestControlsInput.SessionQuestions,
    ): MutationResult<FocusTestSummary> =
        update(goalId, FocusTestControlsInput(sessionQuestions = questions, timeZone = timeZone()), QUESTIONS)

    /**
     * The session's goal when it's an exam: first-week sessions lead with placement questions on
     * every goal, and only an exam's are the Focus test's, which "Not today" can skip.
     */
    suspend fun examGoal(sessionId: UUID): UUID? {
        val day = sessions.day[sessionId]
        day.prepare()
        summary.prepare()
        val goalId =
            day.state.value.value
                ?.goalId ?: return null
        val goal =
            summary.state.value.value
                ?.goals
                ?.firstOrNull { it.id == goalId }
        return goalId.takeIf { goal?.kind == LearnerSummaryGoal.Kind.EXAM }
    }

    suspend fun dismissSuggestion(goalId: UUID): MutationResult<FocusTestSummary> =
        update(
            goalId,
            FocusTestControlsInput(suggestion = FocusTestControlsInput.Suggestion.DISMISSED, timeZone = timeZone()),
            setOf(DataDomain.Goals),
        )

    private suspend fun update(
        goalId: UUID,
        input: FocusTestControlsInput,
        invalidating: Set<DataDomain>,
    ) = cache.mutate(invalidating) { api.update(it, goalId, input) }

    private companion object {
        val QUESTIONS = setOf(DataDomain.Goals, DataDomain.UserSession)
    }
}
