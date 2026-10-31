package com.zoonk.android.feature.language

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID
import kotlin.time.TestTimeSource

@OptIn(ExperimentalCoroutinesApi::class)
class LanguageUnitStoreTest {
    /** Starting a lesson from Today, changing the plan or reserving a call all change what the unit shows. */
    @Test
    fun theUnitReadsAgainWhenThePlanTodaysSessionOrCallTimeChange() =
        runTest {
            val cache =
                AppCache(
                    FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                    CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)),
                    TestTimeSource(),
                )
            var reads = 0
            val unit =
                LanguageUnitStore({ _, _ ->
                    reads++
                    languageUnit()
                }, cache).unit(UUID.randomUUID())
            val screen = launch { unit.shown.collect {} }
            advanceUntilIdle()

            listOf(DataDomain.Goals, DataDomain.UserSession, DataDomain.Allowance, DataDomain.LearnerModel).forEach {
                cache.invalidate(setOf(it))
                advanceUntilIdle()
            }

            assertEquals(5, reads)
            screen.cancel()
        }
}
