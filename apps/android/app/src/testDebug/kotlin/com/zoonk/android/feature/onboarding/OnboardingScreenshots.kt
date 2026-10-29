package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.StepState
import com.zoonk.android.data.StepTimes
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.onboarding.setup.GoalSetupScreen
import com.zoonk.android.feature.onboarding.setup.LocalSetupSpeech
import com.zoonk.android.feature.onboarding.setup.PlacementStep
import com.zoonk.android.feature.onboarding.setup.PlanRevealStep
import com.zoonk.android.feature.onboarding.start.StartGoalScreen
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanTimeAdvice
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
import org.robolectric.util.ReflectionHelpers
import java.io.File
import java.time.LocalDate

/**
 * Review screenshots of the start flow and goal setup, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*OnboardingScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OnboardingScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneScreen() = capture("phone-screen")

    @Test
    @Config(qualifiers = "w448dp-h997dp-xxhdpi")
    fun largePhoneScreen() = capture("large-phone-screen")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    /** Questions still being written wait for the learner's Start, so it's tapped first. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun placementWaiting() {
        var run by mutableStateOf(
            GenerationRun(
                status = GenerationRun.Status.Following,
                steps = mapOf("understandGoal" to StepState.Completed, "buildSkillGraph" to StepState.Started),
            ),
        )
        val api = FakeOnboardingApi().apply { placement = placementOf(status = "preparing", next = null) }
        compose.setContent { ZoonkTheme { Surface { Placement(api, run) } } }
        compose.onNodeWithText("Start").performClick()
        compose.waitForIdle()
        write("placement-waiting-phone-screen", compose.onRoot().captureToImage().asAndroidBitmap())

        run = GenerationRun(status = GenerationRun.Status.Failed, failure = GenerationFailure.Generation)
        compose.waitForIdle()
        write("placement-waiting-failed-phone-screen", compose.onRoot().captureToImage().asAndroidBitmap())
    }

    /** The questions of a new language pair wait for the learner's Start, so it's tapped first. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun levelTestWaiting() = captureLevelTestWaiting("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun levelTestWaitingDarkMoreContrast() = captureLevelTestWaiting("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun levelTestWaitingAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureLevelTestWaiting("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun levelTestWaitingTablet() = captureLevelTestWaiting("tablet")

    private fun captureLevelTestWaiting(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val api = FakeOnboardingApi().apply { levelTest = preparingTestOf() }
        compose.setContent { ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) { Surface { LevelTest(api) } } }
        compose.onNodeWithText("Start").performClick()
        compose.waitForIdle()
        write("level-test-waiting-$name", compose.onRoot().captureToImage().asAndroidBitmap())

        api.levelTest = preparingTestOf(startedAt = "2026-10-29T10:00:03Z")
        compose.mainClock.advanceTimeBy(3_500)
        compose.waitForIdle()
        write("level-test-writing-$name", compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface { key(index) { SCREENS[index].second() } }
            }
        }
        SCREENS.indices.forEach { screen ->
            // Each navigation entry has its own ViewModels in the app.
            compose.activity.viewModelStore.clear()
            index = screen
            compose.waitForIdle()
            write("${SCREENS[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    private companion object {
        val SCREENS: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "start" to { Start(FakeOnboardingApi(), AppRoute.StartGoal()) },
                "reading" to {
                    Column(Modifier.padding(24.dp)) {
                        GenerationWait(
                            kind = GenerationKind.Understanding,
                            run =
                                GenerationRun(
                                    status = GenerationRun.Status.Following,
                                    steps = mapOf("readGoal" to StepState.Completed, "findExamDates" to StepState.Started),
                                    stepTimes = mapOf("readGoal" to StepTimes(started = 0, completed = 6_000)),
                                ),
                            onRetry = null,
                        )
                    }
                },
                "connection-lost" to {
                    Column(Modifier.padding(24.dp)) {
                        GenerationWait(
                            kind = GenerationKind.Understanding,
                            run = GenerationRun(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection),
                            onRetry = {},
                        )
                    }
                },
                "understood" to {
                    Start(
                        FakeOnboardingApi().apply {
                            draft =
                                understoodDraft(
                                    understanding =
                                        goalsUnderstanding(
                                            title = "Pass the ENEM",
                                            details = ENEM_DETAILS,
                                            examDates =
                                                """
                                                [{"date":"2026-11-08","estimated":false,"label":"Day 1","registrationClosed":false,
                                                  "source":{"title":"Edital ENEM 2026","url":"https://www.gov.br/inep"}},
                                                 {"date":"2026-11-15","estimated":false,"label":"Day 2","registrationClosed":false,"source":null}]
                                                """.trimIndent(),
                                        ),
                                )
                        },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "explain" to {
                    Start(
                        FakeOnboardingApi().apply { draft = understoodDraft(prompt = "how does inflation work", understanding = EXPLAIN) },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "instrument" to {
                    Start(
                        FakeOnboardingApi().apply { draft = understoodDraft(prompt = "play the guitar", understanding = INSTRUMENT) },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "unsafe" to {
                    Start(
                        FakeOnboardingApi().apply { draft = understoodDraft(prompt = "win at roulette", understanding = UNSAFE) },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "placement-intro" to {
                    Placement(FakeOnboardingApi().apply { mockOptions = mockOptionsOf(access = "plusRequired") })
                },
                "placement-question" to {
                    Placement(FakeOnboardingApi().apply { placement = placementOf(answered = 2, started = true, spent = 0.35) })
                },
                "placement-typed" to {
                    Placement(FakeOnboardingApi().apply { placement = placementOf(next = typedQuestion(), started = true, spent = 0.6) })
                },
                "placement-done" to {
                    Placement(
                        FakeOnboardingApi().apply {
                            placement = placementOf(status = "done", next = null, answered = 9, started = true, dayBudgetUsed = true)
                        },
                    )
                },
                "reveal" to {
                    Reveal(
                        FakeOnboardingApi().apply {
                            plan =
                                planOf(feasibility = feasibilityOf(coreFits = true, deepensMostAsked = true), numbers = numbersOf(1_380.0))
                            syllabus =
                                syllabusOf(
                                    listOf(
                                        subjectOf("Civil procedure", percent = 35),
                                        subjectOf("Contracts", percent = 25),
                                        subjectOf("Criminal law", percent = 25),
                                        subjectOf("Ethics", percent = 15, assumed = true),
                                    ),
                                )
                        },
                    )
                },
                "reveal-chapters" to {
                    Reveal(
                        FakeOnboardingApi().apply {
                            val chapters = (1..7).joinToString(",", "[", "]") { chapterOf("Chapter $it") }
                            plan =
                                planOf(
                                    targetDate = null,
                                    endDate = LocalDate.now().plusDays(90),
                                    phases =
                                        listOf(
                                            phaseOf(0, "learn", "current", LocalDate.now(), LocalDate.now().plusDays(90), chapters),
                                        ),
                                )
                        },
                        isGuest = true,
                    )
                },
                "reveal-building" to {
                    Reveal(
                        FakeOnboardingApi().apply { plan = planOf(ready = false) },
                        run =
                            GenerationRun(
                                status = GenerationRun.Status.Following,
                                steps = mapOf("understandGoal" to StepState.Completed, "buildSkillGraph" to StepState.Completed),
                            ),
                    )
                },
                "reveal-reading" to {
                    Reveal(FakeOnboardingApi().apply { plan = planOf(notice = "reading") })
                },
                "setup-purpose" to
                    { Setup(FakeOnboardingApi().apply { setup = { setupView(listOf("purpose", "level", "schedule", "plan")) } }) },
                "setup-level" to { Setup(FakeOnboardingApi().apply { setup = { setupView(listOf("level", "schedule", "plan")) } }) },
                "setup-exam-date" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = { setupView(listOf("targetDate", "schedule", "plan"), kind = "exam", details = ENEM_DETAILS) }
                        },
                    )
                },
                "setup-schedule" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = {
                                setupView(listOf("schedule", "plan"), kind = "exam", details = ENEM_DETAILS, targetDate = "2026-11-08")
                            }
                            advice = {
                                PlanTimeAdvice(
                                    coveredShare = 0.6,
                                    fullCourseEndDate = null,
                                    measure = PlanTimeAdvice.Measure.EXAM,
                                    numbers = null,
                                    ready = true,
                                    targetDate = kotlinx.datetime.LocalDate(2026, 11, 8),
                                    targetDateNamedMonth = false,
                                )
                            }
                        },
                    )
                },
                "setup-buddy" to { Setup(FakeOnboardingApi().apply { setup = { setupView(listOf("buddy", "plan")) } }) },
                "level-test-intro" to { LevelTest(FakeOnboardingApi(), targetLanguage = "ja", native = "pt") },
                "level-test-reading" to { LevelTest(FakeOnboardingApi().apply { levelTest = levelTestOf(answered = 3) }) },
                "level-test-listening" to {
                    LevelTest(FakeOnboardingApi().apply { levelTest = levelTestOf(next = listeningQuestion(), answered = 6) })
                },
                "level-test-speaking" to {
                    LevelTest(FakeOnboardingApi().apply { levelTest = levelTestOf(next = SPEAKING_NEXT, answered = 11) })
                },
                "level-test-done" to {
                    LevelTest(
                        FakeOnboardingApi().apply {
                            levelTest =
                                levelTestOf(
                                    next = DONE_NEXT,
                                    answered = 12,
                                    levels =
                                        listOf(
                                            skillLevelOf("reading", "B1", 2.0),
                                            skillLevelOf("listening", "A2+", 1.5),
                                            skillLevelOf("speaking", "A2", 1.0),
                                        ),
                                )
                        },
                    )
                },
            )

        /**
         * A language goal's setup at its level test, with the app's locale config, which Robolectric
         * doesn't read from the manifest, and a speech player that never plays.
         */
        @Composable
        private fun LevelTest(
            api: FakeOnboardingApi,
            targetLanguage: String = "it",
            native: String = "en",
        ) {
            val context = LocalContext.current
            val speech =
                remember {
                    val config = context.resources.getIdentifier("_generated_res_locale_config", "xml", context.packageName)
                    ReflectionHelpers.setField(context.applicationInfo, "localeConfigRes", config)
                    api.setup = {
                        setupView(
                            listOf("placement", "plan"),
                            kind = "language",
                            details = """{"answered":["level","schedule"],"nativeLanguage":"$native"}""",
                            targetLanguage = targetLanguage,
                        )
                    }
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
            CompositionLocalProvider(LocalSetupSpeech provides speech) { Setup(api) }
        }

        @Composable
        private fun Setup(api: FakeOnboardingApi) {
            val store =
                remember {
                    val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                    OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
                }
            GoalSetupScreen(AppRoute.GoalSetup(GOAL_ID), store, isGuest = false, rememberAppNavigator())
        }

        @Composable
        private fun Start(
            api: FakeOnboardingApi,
            route: AppRoute.StartGoal,
        ) {
            val store =
                remember {
                    val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                    OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
                }
            StartGoalScreen(route, store, sessionKey = "local-a", canAttach = true, rememberAppNavigator())
        }

        @Composable
        private fun Placement(
            api: FakeOnboardingApi,
            run: GenerationRun = GenerationRun(),
        ) {
            val store = rememberStore(api)
            SetupColumn {
                PlacementStep(
                    GOAL_ID,
                    "bar exam",
                    areaCount = 4,
                    run,
                    onRetryRun = {},
                    store,
                    rememberAppNavigator(),
                    onProgress = {},
                    onDone = {},
                )
            }
        }

        @Composable
        private fun Reveal(
            api: FakeOnboardingApi,
            isGuest: Boolean = false,
            run: GenerationRun = GenerationRun(status = GenerationRun.Status.Following),
        ) {
            val store = rememberStore(api)
            SetupColumn {
                PlanRevealStep(examGoal(), isGuest, libraryCourse = null, run, onRetryRun = {}, store, rememberAppNavigator())
            }
        }

        @Composable
        private fun rememberStore(api: FakeOnboardingApi) =
            remember {
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
            }

        /** The setup's column: at least the window's height, so actions sit at its bottom on phones. */
        @Composable
        private fun SetupColumn(content: @Composable ColumnScope.() -> Unit) {
            BoxWithConstraints(Modifier.fillMaxSize()) {
                val height = maxHeight
                Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
                    Column(
                        modifier =
                            Modifier
                                .widthIn(
                                    max = 640.dp,
                                ).fillMaxWidth()
                                .heightIn(min = height)
                                .padding(horizontal = 24.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                        content = content,
                    )
                }
            }
        }
    }
}

private const val ENEM_DETAILS =
    """{"targetCourse":"Medicine","institution":"USP","reason":"I want to be a doctor","answered":["schedule"]}"""
private const val EXPLAIN = """{"status":"explain","question":"How does inflation work?"}"""
private const val INSTRUMENT = """{"status":"instrument","instrument":"guitar"}"""
private const val UNSAFE = """{"status":"unsafe"}"""
