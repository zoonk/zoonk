package com.zoonk.android.feature.today

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import java.util.UUID
import kotlin.time.Instant

internal class FakeTodayApi(
    private val answers: List<Today>,
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
    ) = MistakeListAvailability(ready = 0, tomorrow = 0)

    override suspend fun language(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageToday = error("Not used")

    override suspend fun resumePreview(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = false

    override suspend fun onboardingLeft(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = false

    override suspend fun resume(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = Unit

    override suspend fun answerInsight(
        session: AuthenticatedSession,
        insightId: UUID,
        accepted: Boolean,
    ) = Unit

    override suspend fun answerSuggestedGoal(
        session: AuthenticatedSession,
        suggestionId: UUID,
        accepted: Boolean,
    ): SuggestedGoal = error("Not used")
}
