package com.zoonk.android.feature.mistakes

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.ChoiceAnswer
import com.zoonk.api.models.MistakePractice
import com.zoonk.api.models.MistakePracticeAnswerInput
import com.zoonk.api.models.MistakePracticeAnswerInputRun
import com.zoonk.api.models.MistakePracticeCompletion
import com.zoonk.api.models.MistakePracticeFeedback
import com.zoonk.api.models.MistakePracticeFinishInput
import java.util.UUID

data class PracticeKey(
    val goalId: UUID?,
    val skillId: UUID?,
)

interface MistakesApi {
    suspend fun practice(
        session: AuthenticatedSession,
        key: PracticeKey,
        timeZone: String,
    ): MistakePractice

    suspend fun answer(
        session: AuthenticatedSession,
        mistakeId: UUID,
        input: MistakePracticeAnswerInput,
    ): MistakePracticeFeedback

    suspend fun finish(
        session: AuthenticatedSession,
        input: MistakePracticeFinishInput,
    ): MistakePracticeCompletion
}

class LiveMistakesApi(
    private val api: ApiClients,
) : MistakesApi {
    override suspend fun practice(
        session: AuthenticatedSession,
        key: PracticeKey,
        timeZone: String,
    ) = perform { api.clients(session).mistakes.getCurrentUserMistakePractice(key.goalId, key.skillId, timeZone) }

    override suspend fun answer(
        session: AuthenticatedSession,
        mistakeId: UUID,
        input: MistakePracticeAnswerInput,
    ) = perform { api.clients(session).mistakes.createMistakePracticeAnswer(mistakeId, input) }

    override suspend fun finish(
        session: AuthenticatedSession,
        input: MistakePracticeFinishInput,
    ) = perform { api.clients(session).mistakes.createMistakePracticeCompletion(input) }
}

class MistakesStore(
    private val api: MistakesApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    val practices =
        cache.keyed<PracticeKey, MistakePractice>(
            Audience.SignedIn,
            setOf(DataDomain.LearnerModel),
            isEmpty = { it.practice.isEmpty() },
        ) { session, key ->
            session?.let { api.practice(it, key, timeZone()) }
        }

    /** [attemptId] stays the same when an answer is sent again, so the server records it once. */
    suspend fun answer(
        key: PracticeKey,
        mistakeId: String,
        itemId: String,
        answer: Answer,
        durationMs: Long,
        attemptId: UUID,
        runAnswerIds: List<UUID>,
    ): MutationResult<MistakePracticeFeedback> =
        cache.mutate(invalidating = PRACTICED) { session ->
            api.answer(
                session,
                UUID.fromString(mistakeId),
                MistakePracticeAnswerInput(
                    answer = answer.recode<Answer, ChoiceAnswer>(),
                    durationMs = durationMs,
                    itemId = UUID.fromString(itemId),
                    attemptId = attemptId,
                    run = MistakePracticeAnswerInputRun(runAnswerIds, key.goalId),
                    timeZone = timeZone(),
                ),
            )
        }

    /** Each answer was counted as it came, so this adds only what's new and marks the end. */
    suspend fun finish(
        key: PracticeKey,
        answerIds: List<UUID>,
    ): MutationResult<MistakePracticeCompletion> =
        cache.mutate(invalidating = PRACTICED) { session ->
            api.finish(session, MistakePracticeFinishInput(answerIds, ended = true, goalId = key.goalId, timeZone = timeZone()))
        }

    private companion object {
        val PRACTICED = setOf(DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
