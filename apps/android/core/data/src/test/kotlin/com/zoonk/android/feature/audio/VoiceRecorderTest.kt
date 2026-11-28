package com.zoonk.android.feature.audio

import android.Manifest
import android.app.Application
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class VoiceRecorderTest {
    private val context = ApplicationProvider.getApplicationContext<Application>()
    private val main = TestScope()
    private val opener = StandardTestDispatcher(main.testScheduler)

    init {
        shadowOf(context).grantPermissions(Manifest.permission.RECORD_AUDIO)
    }

    /** Leaving while the microphone opens: once it opens, it's closed again, and the next Record starts cleanly. */
    @Test
    fun aTakeCancelledWhileTheMicrophoneOpensNeverGoesLive() {
        val recorder = VoiceRecorder(context, main, opener)
        assertTrue(recorder.start {})
        assertEquals(VoiceRecorder.Status.Acquiring, recorder.state.value)

        recorder.cancel()
        main.runCurrent()

        assertEquals(VoiceRecorder.Status.Idle, recorder.state.value)
        assertTrue(context.cacheDir.listFiles { file -> file.name.startsWith("voice-") }.isNullOrEmpty())

        assertTrue(recorder.start {})
        main.runCurrent()
        val live = recorder.state.value as VoiceRecorder.Status.Recording
        assertTrue(live.startedAt > 0)
        recorder.cancel()
    }

    @Test
    fun aLoudPeakFillsTheMeterAndSilenceRests() {
        assertEquals(0f, VoiceRecorder.loudness(0))
        assertEquals(1f, VoiceRecorder.loudness(32_767))
        assertTrue(VoiceRecorder.loudness(3_000) in 0.3f..0.8f)
    }
}
