package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.StepState
import com.zoonk.android.data.StepTimes
import com.zoonk.android.feature.onboarding.start.StartGoalScreen
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
 * Review screenshots of the start flow, written only on demand:
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
            )

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
            StartGoalScreen(route, store, canAttach = true, rememberAppNavigator())
        }
    }
}

private const val ENEM_DETAILS =
    """{"targetCourse":"Medicine","institution":"USP","reason":"I want to be a doctor","answered":["schedule"]}"""
private const val EXPLAIN = """{"status":"explain","question":"How does inflation work?"}"""
private const val INSTRUMENT = """{"status":"instrument","instrument":"guitar"}"""
private const val UNSAFE = """{"status":"unsafe"}"""
