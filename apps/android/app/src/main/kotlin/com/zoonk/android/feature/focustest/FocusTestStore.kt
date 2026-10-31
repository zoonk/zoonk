package com.zoonk.android.feature.focustest

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.practice.GradedAnswer
import com.zoonk.android.feature.practice.input
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestGeneration
import com.zoonk.api.models.FocusTestInput
import com.zoonk.api.models.FocusTestResult
import kotlinx.serialization.builtins.ListSerializer
import java.util.UUID

/** A goal's focus test: [total] questions, [questionsPerArea] on each of its [areas]; some may not be written yet. */
data class FocusTestRead(
    val areas: List<String>,
    val questions: List<Question>,
    val questionsPerArea: Int,
    val words: TrueFalseWords,
) {
    val total: Int get() = areas.size * questionsPerArea
}

interface FocusTestApi {
    suspend fun focusTest(
        session: AuthenticatedSession,
        goalId: UUID,
    ): FocusTest

    suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
    ): FocusTestGeneration

    suspend fun submit(
        session: AuthenticatedSession,
        goalId: UUID,
        input: FocusTestInput,
    ): FocusTestResult
}

class LiveFocusTestApi(
    private val api: ApiClients,
) : FocusTestApi {
    override suspend fun focusTest(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.getFocusTest(goalId) }

    override suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.createFocusTestGeneration(goalId) }

    override suspend fun submit(
        session: AuthenticatedSession,
        goalId: UUID,
        input: FocusTestInput,
    ) = perform { api.clients(session).plans.submitFocusTest(goalId, input) }
}

class FocusTestStore(
    private val api: FocusTestApi,
    private val cache: AppCache,
    private val drafts: DraftStore,
    private val timeZone: () -> String,
) {
    val tests =
        cache.keyed<UUID, FocusTestRead>(Audience.SignedIn, READ_DOMAINS) { session, goalId ->
            session?.let { api.focusTest(it, goalId).read() }
        }

    /** From the learner's Start only: it writes the missing questions. */
    suspend fun writeQuestions(goalId: UUID): MutationResult<FocusTestGeneration> =
        cache.mutate(invalidating = setOf(DataDomain.Allowance)) { session -> api.writeQuestions(session, goalId) }

    suspend fun submit(
        goalId: UUID,
        answers: List<GradedAnswer>,
    ): MutationResult<FocusTestResult> =
        cache.mutate(invalidating = SUBMITTED) { session ->
            api.submit(session, goalId, FocusTestInput(answers.map { it.input() }, timeZone()))
        }

    fun answersDraft(
        session: AuthenticatedSession,
        goalId: UUID,
    ): DraftHandle<List<GradedAnswer>> = drafts.open(session, "focus-test:$goalId", ListSerializer(GradedAnswer.serializer()))

    private companion object {
        val READ_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress)
        val SUBMITTED = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress)
    }
}

private fun FocusTest.read() =
    FocusTestRead(
        areas = areas,
        questions = questions.map { it.recode() },
        questionsPerArea = questionsPerArea.toInt(),
        words = trueFalseLabels.recode(),
    )
