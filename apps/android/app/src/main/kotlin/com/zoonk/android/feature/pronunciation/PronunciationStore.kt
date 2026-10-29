package com.zoonk.android.feature.pronunciation

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.toGradeOutcome
import com.zoonk.api.models.PronunciationAnswerGrade
import com.zoonk.api.models.PronunciationReviewWord
import com.zoonk.api.models.PronunciationReviews
import com.zoonk.api.models.PronunciationRoundInput
import com.zoonk.api.models.PronunciationRoundResult
import java.util.UUID

typealias ReviewWord = PronunciationReviewWord

interface PronunciationApi {
    suspend fun reviews(
        session: AuthenticatedSession,
        goalId: String,
    ): PronunciationReviews

    suspend fun answer(
        session: AuthenticatedSession,
        reviewId: String,
        goalId: String,
        roundId: String,
        recording: VoiceRecording,
        timeZone: String,
    ): PronunciationAnswerGrade

    suspend fun finish(
        session: AuthenticatedSession,
        roundId: String,
        goalId: String,
        timeZone: String,
    ): PronunciationRoundResult
}

class LivePronunciationApi(
    private val api: ApiClients,
) : PronunciationApi {
    override suspend fun reviews(
        session: AuthenticatedSession,
        goalId: String,
    ) = perform { api.clients(session).language.listPronunciationReviews(UUID.fromString(goalId)) }

    /** Grading a recording takes the server a few seconds, so it gets the slow client. */
    override suspend fun answer(
        session: AuthenticatedSession,
        reviewId: String,
        goalId: String,
        roundId: String,
        recording: VoiceRecording,
        timeZone: String,
    ) = perform {
        api.streamingClients(session).language.answerPronunciationReview(
            reviewId = UUID.fromString(reviewId),
            durationMs = recording.durationMs,
            goalId = UUID.fromString(goalId),
            roundId = UUID.fromString(roundId),
            audio = recording.part(),
            timeZone = timeZone,
        )
    }

    override suspend fun finish(
        session: AuthenticatedSession,
        roundId: String,
        goalId: String,
        timeZone: String,
    ) = perform {
        api.clients(session).language.completePronunciationRound(
            UUID.fromString(roundId),
            PronunciationRoundInput(UUID.fromString(goalId), timeZone),
        )
    }
}

/** The words due to say again, per goal. An answer changes them, so they follow the learner model. */
class PronunciationStore(
    private val api: PronunciationApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    private val reviews =
        cache.keyed<String, PronunciationReviews>(Audience.SignedIn, setOf(DataDomain.LearnerModel)) { session, goalId ->
            session?.let { api.reviews(it, goalId) }
        }

    fun reviews(goalId: String) = reviews[goalId]

    suspend fun answer(
        reviewId: String,
        goalId: String,
        roundId: String,
        recording: VoiceRecording,
    ): GradeOutcome<PronunciationAnswerGrade> =
        cache
            .mutate(setOf(DataDomain.LearnerModel)) { api.answer(it, reviewId, goalId, roundId, recording, timeZone()) }
            .toGradeOutcome()

    suspend fun finish(
        roundId: String,
        goalId: String,
    ): MutationResult<PronunciationRoundResult> =
        cache.mutate(setOf(DataDomain.UserProgress)) { api.finish(it, roundId, goalId, timeZone()) }
}
