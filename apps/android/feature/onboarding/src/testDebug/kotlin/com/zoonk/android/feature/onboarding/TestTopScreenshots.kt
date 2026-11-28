package com.zoonk.android.feature.onboarding

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.onboarding.setup.GoalSetupScreen
import com.zoonk.android.feature.onboarding.setup.LocalSetupSpeech
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of a test's question inside onboarding's own frame: the bar's title and segments, the ways out
 * behind ✕, and the listening question's row and bar in each of its states. Written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*TestTopScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class TestTopScreenshots(
    private val theme: String,
    private val scale: Float,
) {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    /** The message plays until this completes, so a capture can show it playing. */
    private var playing: CompletableDeferred<Unit>? = null

    @Before
    fun onlyOnDemand() {
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        RuntimeEnvironment.setFontScale(scale)
    }

    @Test
    fun courseQuestion() = course("course-question", placementAttemptOf(answered = 1, chapter = "When ownership is diluted"), DILUTION)

    @Test
    fun courseQuestionLongTopic() =
        course(
            "course-question-long-topic",
            placementAttemptOf(answered = 2, chapter = "Civil procedure, from the complaint to the final judgment and its appeals"),
            orderQuestion(),
        )

    @Test
    fun courseWaysOut() =
        course("course-ways-out", placementAttemptOf(answered = 1, chapter = "When ownership is diluted"), DILUTION) {
            compose.onNodeWithContentDescription("Leave").performClick()
        }

    @Test
    fun listening() = language("listening", listeningQuestion(audioUrl = CLIP, durationMs = DURATION))

    @Test
    fun listeningPlaying() =
        language("listening-playing", listeningQuestion(audioUrl = CLIP, durationMs = DURATION)) {
            playing = CompletableDeferred()
            compose.onNodeWithContentDescription("Play the message").performClick()
            compose.mainClock.advanceTimeBy(PLAYED_MS)
        }

    @Test
    fun listeningHeard() =
        language("listening-heard", listeningQuestion(audioUrl = CLIP, durationMs = DURATION)) {
            compose.onNodeWithContentDescription("Play the message").performClick()
        }

    /** A message that didn't play: the row's own button is the retry, and the note only says why. */
    @Test
    fun listeningFailed() =
        language("listening-failed", listeningQuestion()) {
            compose.onNodeWithContentDescription("Play the message").performClick()
        }

    @Test
    fun listeningOnItsWay() = language("listening-on-its-way", listeningQuestion(audioPending = true))

    @Test
    fun reading() = language("reading", next = null, answered = 1)

    private fun course(
        name: String,
        attempt: com.zoonk.api.models.PlacementAttempt,
        question: String,
        act: () -> Unit = {},
    ) {
        val api =
            FakeOnboardingApi().apply {
                setup = {
                    setupView(
                        steps = listOf("placement", "plan"),
                        placement = """{"mode":"resume","test":{"kind":"course","offer":{"estimatedMinutes":4,"questions":8}}}""",
                    )
                }
                placement = placementOf(next = question).copy(attempt = attempt)
            }
        capture(name, api, act)
    }

    private fun language(
        name: String,
        next: String?,
        answered: Int = 5,
        act: () -> Unit = {},
    ) {
        val api =
            FakeOnboardingApi().apply {
                setup = {
                    setupView(
                        steps = listOf("placement", "plan"),
                        kind = "language",
                        targetLanguage = "it",
                        placement = """{"mode":"offer","test":{"kind":"language"}}""",
                    )
                }
                levelTest =
                    next?.let { levelTestOf(next = it, answered = answered, attemptId = ATTEMPT, canStop = true) }
                        ?: levelTestOf(answered = answered, attemptId = ATTEMPT)
            }
        capture(name, api, act)
    }

    private fun capture(
        name: String,
        api: FakeOnboardingApi,
        act: () -> Unit,
    ) {
        compose.setContent {
            val context = LocalContext.current
            val session = remember { FakeSession(AuthenticatedSession("ana", "token-a", "local-a")) }
            val speech = remember { speech(context.cacheDir, session) }
            val cache = remember { AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
            val store = remember { OnboardingStore(api, cache, session) { SignInResult.SignedIn } }
            ZoonkTheme(darkTheme = theme == "dark") {
                Surface {
                    CompositionLocalProvider(LocalSetupSpeech provides speech) {
                        GoalSetupScreen(
                            AppRoute.GoalSetup(GOAL_ID),
                            store,
                            PlanStore(FakePlanApi(), cache),
                            isGuest = false,
                            rememberAppNavigator(),
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
        act()
        compose.waitForIdle()
        val size = if (scale > 1f) "-2x" else ""
        val file = File(folder, "test-top/$name-phone-$theme$size.png").apply { parentFile?.mkdirs() }
        // An open sheet draws in its own window over the page's.
        writeRender(
            file,
            compose
                .onAllNodes(isRoot())
                .onLast()
                .captureRender()
                .asAndroidBitmap(),
        )
        println("Screenshot ${file.path}")
    }

    /** Recordings download from a stand-in server and play until [playing] completes, at once when it's unset. */
    private fun speech(
        cache: File,
        session: FakeSession,
    ): SpeechPlayer {
        val http =
            OkHttpClient
                .Builder()
                .addInterceptor { chain ->
                    Response
                        .Builder()
                        .request(chain.request())
                        .protocol(Protocol.HTTP_1_1)
                        .code(200)
                        .message("")
                        .body("mp3".toResponseBody())
                        .build()
                }.build()
        return SpeechPlayer(
            clips = { _, _, _, _ -> throw ApiException(ApiError.Unavailable) },
            files = VoiceFiles(File(cache, "voice"), http, { false }, session, Dispatchers.Main.immediate),
            output =
                object : AudioOutput {
                    override suspend fun play(
                        file: File,
                        rate: Float,
                        onStart: () -> Unit,
                    ): PlaybackEnd {
                        onStart()
                        playing?.await()
                        return PlaybackEnd.Ended
                    }

                    override fun stop() = Unit
                },
            sessions = session,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    }

    companion object {
        const val ATTEMPT = "6f1c2e2a-6d1b-4c8e-9a51-2f4b8f0c7a11"

        /** A question that belongs to the stocks course's topic it's asked under. */
        val DILUTION =
            orderQuestion(
                "Put what happens to your stake in order.",
                listOf("The company issues new shares", "More shares exist in total", "Your share of the company shrinks"),
            )
        const val CLIP = "https://clips.test/level-test/stazione.mp3"
        const val DURATION = 8_000L
        const val PLAYED_MS = 3_000L

        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}-{1}")
        fun screens() =
            listOf(
                arrayOf<Any>("light", 1f),
                arrayOf<Any>("dark", 1f),
                arrayOf<Any>("light", 2f),
            )
    }
}
