package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PollTest {
    private fun cache(scope: CoroutineScope) = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), scope)

    @Test
    fun aReadThatCameBackNotFoundCountsAsFailed() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val resource = cache(scope).resource<String>(Audience.SignedIn) { throw ApiException(ApiError.NotFound) }

            assertFalse(resource.refreshed())
        }

    @Test
    fun aReadThatCameBackWithAValueCounts() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val resource = cache(scope).resource<String>(Audience.SignedIn) { "ready" }

            assertTrue(resource.refreshed())
        }
}
