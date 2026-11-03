package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.StepState
import com.zoonk.android.data.StepTimes
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.setup.LocalSetupWarmUp
import com.zoonk.android.feature.onboarding.setup.NoticeReading
import com.zoonk.android.feature.onboarding.setup.PlacementStep
import com.zoonk.android.feature.onboarding.setup.PlanBuilding
import com.zoonk.android.feature.onboarding.setup.PlanNext
import com.zoonk.android.feature.onboarding.setup.PlanRevealStep
import com.zoonk.android.feature.onboarding.setup.PlanSoFar
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.PageFold
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ExamDocument
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
 * Review screenshots of the setup's waits with the goal's guesses, written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*WarmUpScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * Each plays one learner through the plan's wait, an exam notice's reading on the plan step (its connection lost and
 * back) and the time question, and placement's wait: a guess on each, then the work ready while they're still guessing,
 * its way on pinned to the page's bottom.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WarmUpScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compact() = capture("compact")

    @Test
    @Config(qualifiers = "w700dp-h1200dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("expanded")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    fun darkMoreContrast() = capture("dark-more-contrast", dark = true, moreContrast = true)

    /** A phone's height, so the held wait's pinned button shows under content that runs past the screen. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun twiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("font200")
    }

    /** An open book: the wait and its pinned button on the page before the fold, the plan so far after it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("book", fold = PageFold(start = 418.dp, end = 434.dp, bounds = Rect.Zero))

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: PageFold? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        // Its own places in the deck, so the documents' reading shows the first cards and placement still has its last.
        val readingWarmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        val planApi = FakePlanApi().apply { shownPlan = planOf(ready = false) }
        val plans = PlanStore(planApi, cache)
        val readingPlanApi = FakePlanApi().apply { shownPlan = planOf(notice = "reading") }
        val readingPlans = PlanStore(readingPlanApi, cache)
        val onboardingApi = FakeOnboardingApi().apply { placement = placementOf(status = "preparing", next = null) }
        val onboarding = OnboardingStore(onboardingApi, cache, session) { SignInResult.SignedIn }
        val mocks = MockStore(FakeMockApi(options = null), cache)
        var scene by mutableIntStateOf(0)
        var scheduleReady by mutableStateOf(false)
        var noticeRead by mutableStateOf(false)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    CompositionLocalProvider(LocalSetupWarmUp provides warmUps) {
                        SetupColumn(fold, aside = fold?.let { { PlanSoFar(examGoal()) } }) {
                            key(scene) {
                                when (scene) {
                                    0 -> {
                                        PlanRevealStep(
                                            examGoal(),
                                            isGuest = false,
                                            libraryCourse = null,
                                            run = MAPPING,
                                            onRetryRun = {},
                                            plans = plans,
                                            navigator = rememberAppNavigator(),
                                            here = AppRoute.GoalSetup(GOAL_ID),
                                        )
                                    }

                                    1 -> {
                                        val hold = rememberReadyHold(scheduleReady)
                                        PlanBuilding(MAPPING, onRetry = null, hold = hold, next = PlanNext.TimeQuestion)
                                    }

                                    2 -> {
                                        CompositionLocalProvider(LocalSetupWarmUp provides readingWarmUps) {
                                            PlanRevealStep(
                                                examGoal(),
                                                isGuest = false,
                                                libraryCourse = null,
                                                run = MAPPING,
                                                onRetryRun = {},
                                                plans = readingPlans,
                                                navigator = rememberAppNavigator(),
                                                here = AppRoute.GoalSetup(GOAL_ID),
                                            )
                                        }
                                    }

                                    3 -> {
                                        CompositionLocalProvider(LocalSetupWarmUp provides readingWarmUps) {
                                            val hold = rememberReadyHold(noticeRead)
                                            NoticeReading(
                                                ExamDocument.NOTICE,
                                                lastEdition = false,
                                                WARM_UP_ID,
                                                failure = null,
                                                onRetry = null,
                                                hold,
                                                PlanNext.TimeQuestion,
                                            )
                                        }
                                    }

                                    else -> {
                                        PlacementStep(
                                            GOAL_ID,
                                            "beekeeping",
                                            areaCount = 0,
                                            MAPPING,
                                            onRetryRun = {},
                                            onboarding,
                                            mocks,
                                            rememberAppNavigator(),
                                            onProgress = {},
                                            onDone = {},
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        compose.waitForIdle()
        write("plan-wait-$name")
        compose.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()
        compose.waitForIdle()
        write("plan-wait-guessed-$name")
        planApi.shownPlan = planOf()
        compose.mainClock.advanceTimeBy(3_500)
        compose.waitForIdle()
        write("plan-wait-ready-$name")

        scene = 1
        compose.waitForIdle()
        compose.onNodeWithText("8").performScrollTo().performClick()
        scheduleReady = true
        compose.waitForIdle()
        write("time-wait-ready-$name")

        scene = 2
        compose.waitForIdle()
        write("plan-reading-$name")
        compose.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()
        readingPlanApi.planFailure = ApiException(ApiError.Network)
        compose.mainClock.advanceTimeBy(10_500)
        compose.waitForIdle()
        write("plan-reading-connection-lost-$name")
        readingPlanApi.planFailure = null
        readingPlanApi.shownPlan = planOf()
        compose.onNodeWithText("Reconnect").performScrollTo().performClick()
        compose.mainClock.advanceTimeBy(3_500)
        compose.waitForIdle()
        write("plan-reading-ready-$name")

        scene = 3
        compose.waitForIdle()
        compose.onNodeWithText("8").performScrollTo().performClick()
        noticeRead = true
        compose.waitForIdle()
        write("time-reading-ready-$name")

        scene = 4
        compose.waitForIdle()
        compose.onNodeWithText("Start").performScrollTo().performClick()
        compose.waitForIdle()
        write("placement-wait-$name")
        compose.onNodeWithText("A summer worker").performScrollTo().performClick()
        onboardingApi.placement = placementOf(started = true)
        compose.mainClock.advanceTimeBy(3_500)
        compose.waitForIdle()
        write("placement-wait-ready-$name")
    }

    private fun write(name: String) {
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    private companion object {
        val MAPPING =
            GenerationRun(
                status = GenerationRun.Status.Following,
                steps = mapOf("understandGoal" to StepState.Completed, "buildSkillGraph" to StepState.Started),
                stepTimes = mapOf("understandGoal" to StepTimes(started = 0, completed = 8_000)),
                skillName = "Prepare colonies for winter",
                warmUpId = WARM_UP_ID,
            )
    }
}
