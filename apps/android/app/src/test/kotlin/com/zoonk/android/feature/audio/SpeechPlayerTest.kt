package com.zoonk.android.feature.audio

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.ui.components.Limit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.HttpUrl
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class SpeechPlayerTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val server = MockWebServer()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")
    private val sessions = FakeSession(ana)
    private val output = FakeOutput()
    private val asked = mutableListOf<String>()
    private var refusal: ApiException? = null

    @Before
    fun start() {
        server.start()
    }

    @After
    fun stop() {
        server.close()
    }

    private fun TestScope.player(): SpeechPlayer {
        val dispatcher = StandardTestDispatcher(testScheduler)
        val files = VoiceFiles(folder.root, apiHttpClient(), ::isPrivate, sessions, dispatcher)
        val clips =
            SpeechClips { session, _, text, personal ->
                asked += "${session.accountId}:$text"
                refusal?.let { throw it }
                server.url(if (personal) "/v1/files/clips/${session.accountId}/$text.mp3" else "/blob/$text.mp3").toString()
            }
        return SpeechPlayer(clips, files, output, sessions, CoroutineScope(SupervisorJob() + dispatcher))
    }

    private fun isPrivate(url: HttpUrl) = url.encodedPath.startsWith("/v1/files/")

    private fun audio(status: Int = 200) =
        MockResponse
            .Builder()
            .code(status)
            .body("mp3")
            .build()

    @Test
    fun speakingForAnotherOwnerStopsTheSoundBefore() =
        runTest {
            repeat(2) { server.enqueue(audio()) }
            val player = player()
            player.speak("word", "it", listOf(SpokenText("ciao")))
            advanceUntilIdle()
            assertEquals(SpeechState.Playing, player.state("word"))

            player.stop("other")
            assertEquals(SpeechState.Playing, player.state("word"))

            player.speak("sentence", "it", listOf(SpokenText("grazie")))
            advanceUntilIdle()
            assertEquals(SpeechState.Idle, player.state("word"))
            assertEquals(SpeechState.Playing, player.state("sentence"))
            assertEquals(2, output.stops.size)

            player.stop("sentence")
            assertNull(player.playback.value)
        }

    @Test
    fun segmentsPlayInOrderAndEachTextIsVoicedOncePerSession() =
        runTest {
            repeat(2) { server.enqueue(audio()) }
            val player = player()
            var done = 0
            val segments = listOf(SpokenText("uno"), SpokenText("due"))
            repeat(2) {
                player.speak("dialogue", "it", segments, rate = SpeechPlayer.SLOW_RATE) { done += 1 }
                advanceUntilIdle()
                assertEquals(0, player.playback.value?.segment)
                output.finish(PlaybackEnd.Ended)
                advanceUntilIdle()
                assertEquals(1, player.playback.value?.segment)
                output.finish(PlaybackEnd.Ended)
                advanceUntilIdle()
            }
            assertEquals(2, done)
            assertNull(player.playback.value)
            assertEquals(listOf("ana:uno", "ana:due"), asked)
            assertEquals(2, server.requestCount)
            assertEquals(listOf(0.7f, 0.7f, 0.7f, 0.7f), output.rates)

            sessions.session = bia
            server.enqueue(audio())
            player.speak("dialogue", "it", segments.take(1))
            advanceUntilIdle()
            assertEquals("bia:uno", asked.last())
        }

    @Test
    fun aRecordingThatWontLoadOrPlayIsReadAloudInstead() =
        runTest {
            server.enqueue(audio(404))
            server.enqueue(audio())
            val player = player()
            player.speak("word", "it", listOf(SpokenText("ciao", recording = server.url("/native/ciao.mp3").toString())))
            advanceUntilIdle()
            assertEquals(listOf("ana:ciao"), asked)
            assertEquals(SpeechState.Playing, player.state("word"))

            repeat(2) { server.enqueue(audio()) }
            player.speak("word", "it", listOf(SpokenText("pane", recording = server.url("/native/pane.mp3").toString())))
            advanceUntilIdle()
            output.finish(PlaybackEnd.Failed)
            advanceUntilIdle()
            assertEquals("ana:pane", asked.last())
            assertEquals(SpeechState.Playing, player.state("word"))
        }

    @Test
    fun aRefusedClipSaysWhyAndIsAskedForAgainOnRetry() =
        runTest {
            refusal = ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", 403)
            val player = player()
            player.speak("word", "it", listOf(SpokenText("ciao")))
            advanceUntilIdle()
            assertEquals(SpeechState.Failed(Limit.SignUpRequired), player.state("word"))

            refusal = null
            server.enqueue(audio())
            player.speak("word", "it", listOf(SpokenText("ciao")))
            advanceUntilIdle()
            assertEquals(SpeechState.Playing, player.state("word"))
            assertEquals(2, asked.size)
        }

    @Test
    fun aRejectedSessionSignsOut() =
        runTest {
            refusal = ApiException(ApiError.Unauthorized, status = 401)
            val player = player()
            player.speak("word", "it", listOf(SpokenText("ciao")))
            advanceUntilIdle()
            assertEquals(listOf(ana), sessions.expired)
            assertEquals(SpeechState.Failed(null), player.state("word"))
        }

    @Test
    fun onlyTheLearnersOwnClipCarriesTheirSessionAndLeavesWithIt() =
        runTest {
            repeat(2) { server.enqueue(audio()) }
            val player = player()
            player.speak("better", "it", listOf(SpokenText("io vado", personal = true)))
            advanceUntilIdle()
            player.speak("word", "it", listOf(SpokenText("ciao")))
            advanceUntilIdle()
            assertEquals("Bearer token-a", server.takeRequest().headers["Authorization"])
            assertNull(server.takeRequest().headers["Authorization"])

            val files = VoiceFiles(folder.root, apiHttpClient(), ::isPrivate, sessions)
            assertEquals(1, File(folder.root, ana.localId).listFiles()?.size)
            files.forget(ana)
            assertEquals(false, File(folder.root, ana.localId).exists())
            assertEquals(1, folder.root.listFiles { file -> file.isFile }?.size)
        }

    @Test
    fun aSoundAskedForByOneLearnerNeverUsesTheNextLearnersSession() =
        runTest {
            server.enqueue(audio())
            val player = player()
            player.speak("word", "it", listOf(SpokenText("ciao")))
            sessions.session = bia
            advanceUntilIdle()
            assertEquals(listOf("ana:ciao"), asked)
            assertEquals(SpeechState.Idle, player.state("word"))
            assertEquals(emptyList<Float>(), output.rates)
        }

    @Test
    fun aPrivateClipTheFilesRouteRejectsSignsThatSessionOut() =
        runTest {
            server.enqueue(audio(401))
            val player = player()
            player.speak("better", "it", listOf(SpokenText("io vado", personal = true)))
            advanceUntilIdle()
            assertEquals(listOf(ana), sessions.expired)
            assertEquals(SpeechState.Failed(null), player.state("better"))
        }

    @Test
    fun aPrivateClipThatFinishesAfterItsLearnerLeftIsNotKept() =
        runTest {
            server.enqueue(audio())
            val signsOutMidDownload =
                apiHttpClient {
                    addInterceptor { chain ->
                        chain.proceed(chain.request()).also { sessions.session = bia }
                    }
                }
            val files = VoiceFiles(folder.root, signsOutMidDownload, ::isPrivate, sessions)
            val url = server.url("/v1/files/clips/ana/io.mp3").toString()
            val refused = runCatching { files.file(url, ana) }.exceptionOrNull() as ApiException
            assertEquals(ApiError.Unauthorized, refused.error)
            assertEquals(false, File(folder.root, ana.localId).exists())
            assertEquals(0, folder.root.listFiles()?.size)
        }

    private class FakeOutput : AudioOutput {
        val rates = mutableListOf<Float>()
        val stops = mutableListOf<Unit>()
        private var playing: CompletableDeferred<PlaybackEnd>? = null

        override suspend fun play(
            file: File,
            rate: Float,
            onStart: () -> Unit,
        ): PlaybackEnd {
            rates += rate
            val end = CompletableDeferred<PlaybackEnd>().also { playing = it }
            onStart()
            return end.await()
        }

        fun finish(end: PlaybackEnd) {
            playing?.complete(end)
        }

        override fun stop() {
            stops += Unit
            playing?.complete(PlaybackEnd.Stopped)
        }
    }
}
