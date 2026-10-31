package com.zoonk.android.feature.livecall

import android.media.AudioManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** WebRTC's native library, the offer GPT-Live answers and the call audio, which only a device has. */
@RunWith(AndroidJUnit4::class)
class WebRtcDeviceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val audio = context.getSystemService(AudioManager::class.java)

    @Test
    fun anOfferCarriesTheLearnersAudioAndTheEventsChannel() =
        runBlocking(Dispatchers.Main) {
            val before = audio.mode
            val transport = WebRtcLiveCallTransport(context, microphone = false, onEvent = {}, onLost = {})

            val offer = withTimeout(OFFER_TIMEOUT_MS) { transport.makeOffer() }

            assertTrue(offer.contains("m=audio"))
            assertTrue("The oai-events channel needs an SCTP section", offer.contains("m=application"))
            assertTrue(offer.contains("a=sendrecv"))
            assertEquals(AudioManager.MODE_IN_COMMUNICATION, audio.mode)

            transport.close()
            withContext(Dispatchers.Default) { Thread.sleep(SETTLE_MS) }
            assertEquals("Closing gives the call audio back", before, audio.mode)
        }

    @Test
    fun aSecondCallMakesItsOwnPeer() =
        runBlocking(Dispatchers.Main) {
            repeat(2) {
                val transport = WebRtcLiveCallTransport(context, microphone = false, onEvent = {}, onLost = {})
                assertTrue(withTimeout(OFFER_TIMEOUT_MS) { transport.makeOffer() }.contains("m=audio"))
                transport.close()
            }
        }

    private companion object {
        const val OFFER_TIMEOUT_MS = 10_000L
        const val SETTLE_MS = 200L
    }
}
