package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MusicRendererTest {
    private val sampleRate = 48_000.0
    private val renderer = MusicRenderer(sampleRate)
    private val buffer = FloatArray(1024)

    private fun render(heardAt: Double): FloatArray {
        renderer.render(buffer, buffer.size, heardAt)
        return buffer.copyOf()
    }

    @Test
    fun aSoundStartsOnTheFrameItIsHeard() {
        renderer.schedule(listOf(MusicRenderer.Event(heardAt = 10.01, voice = MusicRenderer.Voice.Click, click = MusicClick.Hit)))

        val output = render(heardAt = 10.0)

        assertEquals(480, output.indexOfFirst { it != 0f })
    }

    @Test
    fun aSoundDueInALaterBufferWaitsForIt() {
        renderer.schedule(listOf(MusicRenderer.Event(heardAt = 1.0, voice = MusicRenderer.Voice.Piano, midi = 60, duration = 1.0)))

        assertTrue(render(heardAt = 0.5).all { it == 0f })
        assertFalse(renderer.isSilent)
        assertTrue(render(heardAt = 1.0).any { it != 0f })
    }

    @Test
    fun stoppingFadesWhatSoundsWithinTenMillisecondsAndDropsWhatWaited() {
        renderer.schedule(
            listOf(
                MusicRenderer.Event(heardAt = 0.0, voice = MusicRenderer.Voice.Guitar, midi = 52, duration = 2.0),
                MusicRenderer.Event(heardAt = 0.5, voice = MusicRenderer.Voice.Piano, midi = 64, duration = 2.0),
            ),
        )
        render(heardAt = 0.0)

        renderer.stopAll()
        val fading = render(heardAt = 1024 / sampleRate)

        assertTrue(fading.take(480).any { it != 0f })
        assertTrue(fading.drop(480).all { it == 0f })
        assertTrue(render(heardAt = 0.5).all { it == 0f })
        assertTrue(renderer.isSilent)
    }

    @Test
    fun theRendererFallsSilentOnceEverySoundHasRungOut() {
        renderer.schedule(listOf(MusicRenderer.Event(heardAt = 0.0, voice = MusicRenderer.Voice.Piano, midi = 72, duration = 0.2)))

        var heardAt = 0.0
        while (!renderer.isSilent && heardAt < 2) {
            render(heardAt)
            heardAt += buffer.size / sampleRate
        }

        assertTrue(renderer.isSilent)
        assertTrue(heardAt in 0.45..0.6)
    }
}
