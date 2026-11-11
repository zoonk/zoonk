package com.zoonk.android.feature.mistakes

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepAnswer
import com.zoonk.api.models.MistakePractice
import com.zoonk.api.models.MistakePracticeAnswerInput
import com.zoonk.api.models.MistakePracticeCompletion
import com.zoonk.api.models.MistakePracticeFeedback
import com.zoonk.api.models.MistakePracticeFinishInput
import com.zoonk.api.models.SpokenAnswerGrade
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
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

    suspend fun speak(
        session: AuthenticatedSession,
        mistakeId: UUID,
        stepId: UUID,
        recording: VoiceRecording,
        attemptId: UUID,
        goalId: UUID?,
        answerIds: List<UUID>,
        timeZone: String,
        practiceDurationMs: Long,
    ): SpokenAnswerGrade

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
    ) = perform {
        api
            .clients(
                session,
            ).mistakes
            .getCurrentUserMistakePractice(
                goalId = key.goalId,
                skillId = key.skillId,
                timeZone = timeZone,
                includeAllFormats =
                    com.zoonk.api.apis.MistakesApi.IncludeAllFormatsGetCurrentUserMistakePractice.TRUE,
            )
    }

    override suspend fun answer(
        session: AuthenticatedSession,
        mistakeId: UUID,
        input: MistakePracticeAnswerInput,
    ) = perform { api.streamingClients(session).mistakes.createMistakePracticeAnswer(mistakeId, input) }

    override suspend fun speak(
        session: AuthenticatedSession,
        mistakeId: UUID,
        stepId: UUID,
        recording: VoiceRecording,
        attemptId: UUID,
        goalId: UUID?,
        answerIds: List<UUID>,
        timeZone: String,
        practiceDurationMs: Long,
    ) = perform {
        api.streamingClients(session).language.createSpokenAnswer(
            stepId = stepId,
            durationMs = recording.durationMs,
            audio = recording.part(),
            timeZone = timeZone,
            practiceDurationMs = practiceDurationMs.coerceAtMost(3_600_000),
            mistakeId = mistakeId,
            attemptId = attemptId,
            goalId = goalId,
            answerIds =
                ApiJson.encodeToString(
                    kotlinx.serialization.builtins.ListSerializer(kotlinx.serialization.serializer<String>()),
                    answerIds.map(UUID::toString),
                ),
        )
    }

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
                answerInput(key, "itemId", itemId, ApiJson.encodeToJsonElement(answer), durationMs, attemptId, runAnswerIds),
            )
        }

    suspend fun answerLesson(
        key: PracticeKey,
        mistakeId: String,
        stepId: String,
        answer: LessonStepAnswer?,
        durationMs: Long,
        attemptId: UUID,
        runAnswerIds: List<UUID>,
    ): MutationResult<MistakePracticeFeedback> =
        cache.mutate(invalidating = PRACTICED) { session ->
            api.answer(
                session,
                UUID.fromString(mistakeId),
                answerInput(
                    key,
                    "stepId",
                    stepId,
                    answer?.let { ApiJson.encodeToJsonElement(it) } ?: buildJsonObject { put("dontKnow", true) },
                    durationMs,
                    attemptId,
                    runAnswerIds,
                ),
            )
        }

    suspend fun speak(
        key: PracticeKey,
        mistakeId: String,
        stepId: String,
        recording: VoiceRecording,
        attemptId: UUID,
        answerIds: List<UUID>,
        practiceDurationMs: Long,
    ): MutationResult<SpokenAnswerGrade> =
        cache.mutate(invalidating = PRACTICED) { session ->
            api.speak(
                session,
                UUID.fromString(mistakeId),
                UUID.fromString(stepId),
                recording,
                attemptId,
                key.goalId,
                answerIds,
                timeZone(),
                practiceDurationMs,
            )
        }

    private fun answerInput(
        key: PracticeKey,
        idName: String,
        id: String,
        answer: kotlinx.serialization.json.JsonElement,
        durationMs: Long,
        attemptId: UUID,
        runAnswerIds: List<UUID>,
    ): MistakePracticeAnswerInput =
        ApiJson.decodeFromJsonElement(
            buildJsonObject {
                put(idName, id)
                put("answer", answer)
                put("durationMs", durationMs.coerceAtMost(3_600_000))
                put("attemptId", attemptId.toString())
                put("timeZone", timeZone())
                put(
                    "run",
                    buildJsonObject {
                        putJsonArray("answerIds") { runAnswerIds.forEach { add(it.toString()) } }
                        key.goalId?.let { put("goalId", it.toString()) }
                    },
                )
            },
        )

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
