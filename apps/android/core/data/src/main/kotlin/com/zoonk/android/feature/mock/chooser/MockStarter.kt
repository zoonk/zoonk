package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.MockShape
import java.util.UUID

sealed interface MockStartOutcome {
    /** Started now, or the one already running: either way the learner goes on in it. */
    data class Opened(
        val id: String,
    ) : MockStartOutcome

    /** Its questions are still being written: the server saved the request, and no clock runs. */
    data object Preparing : MockStartOutcome

    data object PlusRequired : MockStartOutcome
}

fun interface MockStartApi {
    suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ): AnytimeMock
}

class LiveMockStartApi(
    private val api: ApiClients,
) : MockStartApi {
    override suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ) = perform { api.clients(session).exams.startAnytimeMock(goalId, AnytimeMockInput(shape = shape)) }
}

/** Starts a mock taken any time, as main's chooser does: only from the learner's tap. */
class MockStarter(
    private val api: MockStartApi,
    private val cache: AppCache,
    private val mocks: MockStore,
) {
    suspend fun start(
        goalId: UUID,
        shape: MockShape,
    ): MutationResult<MockStartOutcome> {
        val result =
            cache.mutate { session ->
                try {
                    outcome(api.start(session, goalId, shape))
                } catch (e: ApiException) {
                    if (e.code == PLUS_REQUIRED) MockStartOutcome.PlusRequired else throw e
                }
            }
        when ((result as? MutationResult.Done)?.value) {
            is MockStartOutcome.Opened -> cache.invalidate(setOf(DataDomain.LearnerModel))
            MockStartOutcome.Preparing -> mocks.requested(goalId, shape)
            MockStartOutcome.PlusRequired -> cache.invalidate(setOf(DataDomain.UserSubscription))
            null -> {}
        }
        return result
    }

    private fun outcome(mock: AnytimeMock): MockStartOutcome =
        when (mock.status) {
            AnytimeMock.Status.STARTED, AnytimeMock.Status.RUNNING -> MockStartOutcome.Opened(checkNotNull(mock.id).toString())
            AnytimeMock.Status.PREPARING -> MockStartOutcome.Preparing
        }

    private companion object {
        const val PLUS_REQUIRED = "PLUS_REQUIRED"
    }
}
