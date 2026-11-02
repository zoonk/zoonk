package com.zoonk.android.feature.activities.music

import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MusicDeviceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    private fun outputThread() = Thread.getAllStackTraces().keys.firstOrNull { it.name == "MusicAudio" }

    @Test
    fun touchesAndTheAudioClockShareOneTimeline() {
        assertEquals(MusicClock.now(), MusicClock.ofUptimeMillis(SystemClock.uptimeMillis()), 0.005)
    }

    @Test
    fun theSynthMeasuresItsDelayRestsWhenQuietAndStopsWhenReleased() =
        runBlocking {
            val audio = withContext(Dispatchers.Main) { MusicAudio(context) }
            val start = withContext(Dispatchers.Main) { audio.soonestHeardTime() } ?: error("The sound didn't start")

            assertFalse(audio.isUnavailable)

            withContext(Dispatchers.Main) {
                audio.play(MusicSound.together(listOf(60, 64, 67), gap = 0.03), MusicInstrument.Piano)
                audio.click(
                    (0 until 8).map {
                        ScheduledClick(
                            if (it % 4 ==
                                0
                            ) {
                                MusicClick.Accent
                            } else {
                                MusicClick.Beat
                            },
                            start + 0.2 + it * 0.25,
                        )
                    },
                )
            }
            delay(1_500)

            val delayMs = ((withContext(Dispatchers.Main) { audio.soonestHeardTime() } ?: 0.0) - MusicClock.now()) * 1000
            Log.i("MusicDeviceTest", "Soonest heard ${"%.1f".format(delayMs)} ms from now")
            assertTrue("$delayMs ms", delayMs in 0.0..500.0)

            delay(4_000)
            assertEquals(Thread.State.WAITING, outputThread()?.state)

            withContext(Dispatchers.Main) { audio.release() }
            delay(500)
            assertEquals(null, outputThread())
        }
}
