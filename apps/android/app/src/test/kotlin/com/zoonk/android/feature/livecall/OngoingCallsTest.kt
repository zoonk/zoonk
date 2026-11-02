package com.zoonk.android.feature.livecall

import android.Manifest
import android.app.Application
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class OngoingCallsTest {
    private val dispatcher = StandardTestDispatcher()
    private val context = ApplicationProvider.getApplicationContext<Application>()

    @Test
    fun theServiceKeepsTheAppUntilTheServerConfirmsTheHangup() =
        runTest(dispatcher) {
            shadowOf(context).grantPermissions(Manifest.permission.RECORD_AUDIO)
            val scope = CoroutineScope(SupervisorJob() + dispatcher)
            val client = FakeCallClient().apply { endAnswers = ArrayDeque(listOf(null, null, false)) }
            val call =
                LiveCall(
                    LiveCallScript("Hola", emptyList(), emptyList(), 3),
                    client,
                    { _, onEvent, onLost -> FakeTransport(true, onEvent, onLost) },
                    scope,
                )
            val calls = OngoingCalls(context, scope)
            call.start(microphone = true)
            calls.keep(call, "Lucía")
            runCurrent()

            call.leave()
            runCurrent()
            assertNotNull("An unconfirmed hangup keeps the call", calls.current.value)
            advanceTimeBy(5.seconds)
            runCurrent()
            assertNotNull(calls.current.value)
            advanceTimeBy(5.seconds)
            runCurrent()

            assertEquals(3, client.ended.size)
            assertNull(calls.current.value)
        }
}
