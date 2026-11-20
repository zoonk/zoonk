package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.MockShape
import java.util.UUID

internal const val STARTED = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a05"

internal fun started(status: AnytimeMock.Status = AnytimeMock.Status.STARTED) = AnytimeMock(UUID.fromString(STARTED), status)

internal fun preparing() = AnytimeMock(id = null, status = AnytimeMock.Status.PREPARING)

internal fun refusal(code: String) = ApiException(ApiError.Unavailable, code, status = 422)

/** Each start answers [starts]'s next answer, the last one again once they run out. */
internal class FakeMockStartApi : MockStartApi {
    var starts: List<() -> AnytimeMock> = listOf { started() }
    val started = mutableListOf<MockShape>()

    override suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ): AnytimeMock {
        started += shape
        return starts[minOf(started.size, starts.size) - 1]()
    }
}
