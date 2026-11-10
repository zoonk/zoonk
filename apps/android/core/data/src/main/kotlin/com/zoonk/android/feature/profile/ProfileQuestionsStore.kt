package com.zoonk.android.feature.profile

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.perform
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestions

interface ProfileQuestionsApi {
    suspend fun questions(session: AuthenticatedSession): ProfileQuestions

    suspend fun answer(
        session: AuthenticatedSession,
        input: ProfileAnswerInput,
    ): ProfileQuestionView
}

class LiveProfileQuestionsApi(
    private val api: ApiClients,
) : ProfileQuestionsApi {
    override suspend fun questions(session: AuthenticatedSession) =
        perform { api.clients(session).profile.getCurrentUserProfileQuestions() }

    override suspend fun answer(
        session: AuthenticatedSession,
        input: ProfileAnswerInput,
    ) = perform { api.clients(session).profile.answerCurrentUserProfileQuestion(input) }.question
}

class ProfileQuestionsStore(
    private val api: ProfileQuestionsApi,
    private val cache: AppCache,
) {
    val questions =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Memory, DataDomain.LearningProfile, DataDomain.LearnerModel)) { session ->
            session?.let { api.questions(it) }
        }

    suspend fun answer(input: ProfileAnswerInput) =
        cache.mutate(
            invalidating = setOf(DataDomain.Memory, DataDomain.LearningProfile, DataDomain.Goals, DataDomain.LearnerModel),
        ) { session -> api.answer(session, input) }
}
