package com.zoonk.android.feature.mock

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.perform
import com.zoonk.api.models.MockOptions
import java.util.UUID

interface MockApi {
    /** Null for a goal that isn't an exam. */
    suspend fun options(
        session: AuthenticatedSession,
        goalId: UUID,
    ): MockOptions?
}

class LiveMockApi(
    private val api: ApiClients,
) : MockApi {
    override suspend fun options(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = notAnExamAsNull { perform { api.clients(session).exams.listMocks(goalId) } }
}

/** The mocks an exam goal offers any time; the exam page and the chooser share it. */
class MockStore(
    private val api: MockApi,
    cache: AppCache,
) {
    val options: KeyedResources<UUID, MockOptions> =
        cache.keyed(Audience.SignedIn, OPTIONS_DOMAINS) { session, goalId -> session?.let { api.options(it, goalId) } }

    companion object {
        val OPTIONS_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.LearningProfile, DataDomain.UserSubscription)
    }
}

/** A goal that isn't an exam has no exam page nor mocks: the API answers 404 or `NOT_AN_EXAM`. */
internal suspend fun <T> notAnExamAsNull(read: suspend () -> T): T? =
    try {
        read()
    } catch (e: ApiException) {
        if (e.error == ApiError.NotFound || e.code == NOT_AN_EXAM) null else throw e
    }

private const val NOT_AN_EXAM = "NOT_AN_EXAM"
