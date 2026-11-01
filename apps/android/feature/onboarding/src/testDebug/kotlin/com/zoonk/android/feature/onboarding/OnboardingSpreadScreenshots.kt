package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
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
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.setup.GoalSetupScreen
import com.zoonk.android.feature.onboarding.setup.LocalSetupSpeech
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.Placement
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of placement and level-test questions across an open book's fold, written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*OnboardingSpreadScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OnboardingSpreadScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = BOOK)
    fun book() = capture("book")

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDark() = capture("book-dark", dark = true)

    @Test
    @Config(qualifiers = Z_FOLD)
    fun galaxyZFold() = capture("zfold")

    @Test
    @Config(qualifiers = BOOK)
    fun bookRightToLeft() = capture("book-rtl", direction = LayoutDirection.Rtl)

    /** Text twice as large leaves no room for two pages, so the question keeps one column before the fold. */
    @Test
    @Config(qualifiers = BOOK)
    fun bookAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("book-font200")
    }

    /** Without a fold the window keeps the plan so far beside the question, as before. */
    @Test
    @Config(qualifiers = BOOK)
    fun bookWithoutAFold() = capture("book-no-fold", open = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone", open = false)

    private fun capture(
        name: String,
        dark: Boolean = false,
        direction: LayoutDirection = LayoutDirection.Ltr,
        open: Boolean = true,
    ) {
        var index by mutableIntStateOf(0)
        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                CompositionLocalProvider(LocalLayoutDirection provides direction, LocalSetupSpeech provides rememberSpeech()) {
                    Surface { key(index) { Setup(remember { SCREENS[index].api() }) } }
                }
            }
        }
        SCREENS.forEachIndexed { screen, shown ->
            // Each navigation entry has its own ViewModels in the app.
            rule.activity.viewModelStore.clear()
            index = screen
            rule.waitForIdle()
            if (shown.start) {
                rule.onNodeWithText("Start").performScrollTo().performClick()
                rule.waitForIdle()
            }
            // A screen opened after the fold hears none from window-testing, so each one is told of it.
            if (open) {
                folds.overrideWindowLayoutInfo(
                    TestWindowLayoutInfo(
                        listOf(
                            FoldingFeature(
                                rule.activity,
                                state = FoldingFeature.State.FLAT,
                                orientation = FoldingFeature.Orientation.VERTICAL,
                            ),
                        ),
                    ),
                )
                rule.waitForIdle()
            }
            val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
            val file = File(folder, "${shown.name}-$name.png").apply { parentFile?.mkdirs() }
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            println("Screenshot ${file.path}")
        }
    }

    @Composable
    private fun Setup(api: FakeOnboardingApi) {
        val session = remember { FakeSession(AuthenticatedSession("ana", "token-a", "local-a")) }
        val cache = remember { AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
        GoalSetupScreen(
            AppRoute.GoalSetup(GOAL_ID),
            remember { OnboardingStore(api, cache, session) { SignInResult.SignedIn } },
            remember { PlanStore(FakePlanApi(), cache) },
            remember { MockStore(FakeMockApi(options = null), cache) },
            isGuest = false,
            rememberAppNavigator(),
        )
    }

    /** Plays nothing, so a listening question shows its message ready to play. */
    @Composable
    private fun rememberSpeech(): SpeechPlayer {
        val context = LocalContext.current
        return remember {
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            SpeechPlayer(
                clips = { _, _, _, _ -> throw ApiException(ApiError.Unavailable) },
                files = VoiceFiles(File(context.cacheDir, "voice"), OkHttpClient(), { false }, session),
                output =
                    object : AudioOutput {
                        override suspend fun play(
                            file: File,
                            rate: Float,
                            onStart: () -> Unit,
                        ) = PlaybackEnd.Ended

                        override fun stop() = Unit
                    },
                sessions = session,
                scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        }
    }

    /** [start] taps the placement's Start, which its questions wait for. */
    private class Screen(
        val name: String,
        val start: Boolean = false,
        val api: () -> FakeOnboardingApi,
    )

    private companion object {
        /** A Pixel 10 Pro Fold's inner display, its fold down the window's middle. */
        const val BOOK = "w852dp-h883dp-xhdpi"
        const val Z_FOLD = "w707dp-h823dp-xhdpi"

        const val VISUAL_QUESTION =
            """{"context":null,"image":null,"itemId":"$ITEM_ID","skillId":"$ITEM_ID","format":"trueFalse","options":null,
            "question":"A contract needs consideration to be binding.",
            "visual":{"kind":"timeline","title":"Court reforms","events":[{"date":"1990","label":"First reform"},{"date":"2004","label":"Second reform"}]}}"""

        val SCREENS =
            listOf(
                Screen("placement-intro") { placement(placementOf()) },
                Screen("placement-choice", start = true) { placement(placementOf()) },
                Screen("placement-typed", start = true) { placement(placementOf(next = typedQuestion())) },
                Screen("placement-visual", start = true) { placement(placementOf(next = VISUAL_QUESTION)) },
                Screen("level-test-reading") { levelTest(levelTestOf(answered = 3)) },
                Screen("level-test-listening") { levelTest(levelTestOf(next = listeningQuestion(), answered = 6)) },
                Screen("level-test-speaking") { levelTest(levelTestOf(next = SPEAKING_NEXT, answered = 11)) },
            )

        fun placement(placement: Placement) =
            FakeOnboardingApi().apply {
                setup = { setupView(listOf("placement", "plan"), details = """{"answered":["level","schedule"],"subject":"bar exam"}""") }
                this.placement = placement
            }

        fun levelTest(test: LanguageLevelTest) =
            FakeOnboardingApi().apply {
                setup = {
                    setupView(
                        listOf("placement", "plan"),
                        kind = "language",
                        details = """{"answered":["level","schedule"],"nativeLanguage":"en"}""",
                        targetLanguage = "it",
                    )
                }
                levelTest = test
            }
    }
}
