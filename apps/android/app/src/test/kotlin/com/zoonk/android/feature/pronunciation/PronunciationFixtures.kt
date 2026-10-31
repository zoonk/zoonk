package com.zoonk.android.feature.pronunciation

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PronunciationAnswerGrade
import com.zoonk.api.models.PronunciationReviewWord
import com.zoonk.api.models.PronunciationReviews
import com.zoonk.api.models.PronunciationRoundResult
import java.util.UUID

internal const val GOAL_ID = "00000000-0000-4000-8000-000000000047"

internal val RECORDING = VoiceRecording(byteArrayOf(1), 800)

internal fun word(
    number: Int,
    text: String,
    respelling: String? = null,
    tip: String? = null,
): ReviewWord =
    PronunciationReviewWord(
        audioUrl = null,
        id = UUID.fromString("00000000-0000-4000-8000-00000000000$number"),
        respelling = respelling,
        romanization = null,
        tip = tip,
        word = text,
    )

internal fun reviews(vararg words: ReviewWord) = PronunciationReviews(UUID.fromString(GOAL_ID), "es", words.toList())

internal fun grade(
    isCorrect: Boolean,
    transcript: String = "a",
): PronunciationAnswerGrade =
    ApiJson.decodeFromString(
        PronunciationAnswerGrade.serializer(),
        """{"attemptId":"00000000-0000-4000-8000-000000000099","isCorrect":$isCorrect,"nextReviewAt":null,"transcript":"$transcript"}""",
    )

internal val RESULT: PronunciationRoundResult =
    ApiJson.decodeFromString(
        PronunciationRoundResult.serializer(),
        """{"ceremony":null,"reached":{"energy":null,"level":null},"brainPower":5,"correct":1,"missionMoment":null,"total":1}""",
    )

/** Answers with [grades] in order; a null one is a recording without words. */
internal class FakePronunciationApi(
    var words: PronunciationReviews = reviews(),
    vararg grades: PronunciationAnswerGrade?,
) : PronunciationApi {
    private val grades = grades.toMutableList()
    val answered = mutableListOf<String>()
    val finished = mutableListOf<String>()
    var finishFails = 0
    var reviewsFail = false

    override suspend fun reviews(
        session: AuthenticatedSession,
        goalId: String,
    ): PronunciationReviews {
        if (reviewsFail) throw ApiException(ApiError.Network)
        return words
    }

    override suspend fun answer(
        session: AuthenticatedSession,
        reviewId: String,
        goalId: String,
        roundId: String,
        recording: VoiceRecording,
        timeZone: String,
    ): PronunciationAnswerGrade {
        answered += reviewId
        return grades.removeAt(0) ?: throw ApiException(ApiError.Unavailable, "NO_SPEECH", 422)
    }

    override suspend fun finish(
        session: AuthenticatedSession,
        roundId: String,
        goalId: String,
        timeZone: String,
    ): PronunciationRoundResult {
        finished += roundId
        if (finishFails > 0) {
            finishFails--
            throw ApiException(ApiError.Network)
        }
        return RESULT
    }
}
