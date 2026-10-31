package com.zoonk.android.feature.audio

import android.Manifest
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class VoiceDeviceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val scope = MainScope()

    @Before
    fun grantMicrophone() {
        InstrumentationRegistry.getInstrumentation().uiAutomation.grantRuntimePermission(
            context.packageName,
            Manifest.permission.RECORD_AUDIO,
        )
    }

    @After
    fun stop() {
        scope.cancel()
    }

    @Test
    fun aTakeIsAnMpeg4FileTheApiAcceptsAndPlaysBack() =
        runBlocking {
            val recorder = VoiceRecorder(context, scope)
            val recorded = CompletableDeferred<VoiceRecording>()
            assertTrue(withContext(Dispatchers.Main) { recorder.start { recorded.complete(it) } })
            delay(1_500)
            withContext(Dispatchers.Main) { recorder.stop() }
            val take = withTimeout(5_000) { recorded.await() }

            assertEquals("ftyp", String(take.audio, 4, 4))
            assertTrue("${take.durationMs} ms", take.durationMs in 1_000..3_000)
            assertTrue("${take.audio.size} bytes", take.audio.size < 2_000_000)
            assertEquals(VoiceRecorder.Status.Idle, recorder.state.value)
            assertTrue(context.cacheDir.listFiles { file -> file.name.startsWith("voice-") }.isNullOrEmpty())

            val file = File(context.cacheDir, "take.m4a").apply { writeBytes(take.audio) }
            val output = withContext(Dispatchers.Main) { ExoAudioOutput(context) }
            var started = false
            val end = withTimeout(10_000) { withContext(Dispatchers.Main) { output.play(file, SpeechPlayer.SLOW_RATE) { started = true } } }
            file.delete()
            assertEquals(PlaybackEnd.Ended, end)
            assertTrue(started)
        }

    @Test
    fun aCancelledTakeIsNeverDelivered() =
        runBlocking {
            val recorder = VoiceRecorder(context, scope)
            var delivered = false
            assertTrue(withContext(Dispatchers.Main) { recorder.start { delivered = true } })
            delay(500)
            withContext(Dispatchers.Main) { recorder.cancel() }
            delay(500)
            assertEquals(false, delivered)
            assertTrue(context.cacheDir.listFiles { file -> file.name.startsWith("voice-") }.isNullOrEmpty())
        }

    @Test
    fun leavingTheScreenMidTakeLeavesNoFile() =
        runBlocking {
            val screen = MainScope()
            val recorder = VoiceRecorder(context, screen)
            assertTrue(withContext(Dispatchers.Main) { recorder.start {} })
            delay(500)
            // A ViewModel closes its scope before onCleared throws the take away.
            withContext(Dispatchers.Main) {
                screen.cancel()
                recorder.cancel()
            }
            delay(500)
            assertTrue(context.cacheDir.listFiles { file -> file.name.startsWith("voice-") }.isNullOrEmpty())
        }
}
