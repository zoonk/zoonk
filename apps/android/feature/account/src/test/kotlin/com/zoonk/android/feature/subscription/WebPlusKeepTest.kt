package com.zoonk.android.feature.subscription

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Keep Plus that didn't save says so only on the Subscription visit that asked. */
@OptIn(ExperimentalCoroutinesApi::class)
class WebPlusKeepTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    @Test
    fun aKeepThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = keep(leaveFirst = true)

    @Test
    fun aKeepFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = keep(leaveFirst = false)

    private fun keep(leaveFirst: Boolean) =
        runTest(dispatcher) {
            val held = CompletableDeferred<Unit>()
            val cancellation =
                WebPlusCancellationViewModel({ error("Not used") }) {
                    held.await()
                    MutationResult.Failed(ApiError.Network)
                }

            cancellation.keep()
            runCurrent()
            if (leaveFirst) cancellation.visit.end()
            held.complete(Unit)
            advanceUntilIdle()
            if (!leaveFirst) {
                assertTrue(cancellation.keepFailed)
                cancellation.visit.end()
            }

            assertFalse(cancellation.keepFailed)
        }
}
