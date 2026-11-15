package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID
import kotlin.time.Instant

class FakeTodayApi(
    var answers: List<Today>,
) : TodayApi {
    var reads = 0
    var changed = false
    val asked = mutableListOf<Instant>()

    override suspend fun today(
        session: AuthenticatedSession,
        timeZone: String,
    ) = answers[minOf(reads++, answers.lastIndex)]

    override suspend fun todayChanged(
        session: AuthenticatedSession,
        goalId: UUID,
        since: Instant,
    ): Boolean {
        asked += since
        return changed
    }

    override suspend fun brainPower(session: AuthenticatedSession): Long? = null

    override suspend fun prepareLessons(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = Unit

    override suspend fun mistakes(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = GoalMistakes(MistakeListAvailability(ready = 0, tomorrow = 0), total = 0)

    override suspend fun language(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageToday = error("Not used")

    override suspend fun resumePreview(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = false

    /** What a resume throws once [resumeGate] opens. */
    var resumeFailure: ApiException? = null
    var resumeGate: CompletableDeferred<Unit>? = null

    override suspend fun resume(
        session: AuthenticatedSession,
        goalId: UUID,
    ) {
        resumeGate?.await()
        resumeFailure?.let { throw it }
    }

    /** The quotes insight answers sent, in order. */
    val insightQuotes = mutableListOf<String?>()

    /** What an insight answer comes back as; the answered insight when null. */
    var insightAnswer: MemoryInsight? = null

    /** What an insight answer throws once [insightGate] opens. */
    var insightFailure: ApiException? = null
    var insightGate: CompletableDeferred<Unit>? = null

    override suspend fun answerInsight(
        session: AuthenticatedSession,
        insightId: UUID,
        accepted: Boolean,
        quote: String?,
    ): MemoryInsight {
        insightQuotes += quote
        insightGate?.await()
        insightFailure?.let { throw it }
        return insightAnswer
            ?: decodeFixture("memory-insight", "id" to insightId.toString(), "status" to if (accepted) "accepted" else "dismissed")
    }

    /** The answer a suggested goal's Start or Not now saves; held as long as it suspends. */
    var suggestedGoalAnswer: suspend (UUID, Boolean) -> SuggestedGoal = { _, _ -> error("Not used") }

    override suspend fun answerSuggestedGoal(
        session: AuthenticatedSession,
        suggestionId: UUID,
        accepted: Boolean,
    ): SuggestedGoal = suggestedGoalAnswer(suggestionId, accepted)
}
