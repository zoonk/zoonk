package com.zoonk.android.feature.session

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.flow
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the goal's first lesson's wait on the session, reached from Today, written only on demand:
 * `./gradlew :feature:today:testDebugUnitTest --tests '*NextStopWarmUpScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * The card under the writing progress, a guess, then the lesson written while the learner reads the answer.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NextStopWarmUpScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
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

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun twiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("font200")
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("book", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDarkMoreContrast() = capture("book-dark-more-contrast", dark = true, moreContrast = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookRightToLeft() = capture("book-rtl", fold = true, layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("book-font200", fold = true)
    }

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBook() = capture("small-book", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookWithWorkMeanwhile() = capture("book-meanwhile", fold = true, alternative = meanwhile())

    private fun meanwhile() = step(2, kind = StudyBlock.Kind.PRACTICE).copy(title = "Pollen and nectar")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compactWithWorkMeanwhileAndStop() = capture("compact-meanwhile-stop", alternative = meanwhile(), stoppable = true)

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expandedWithWorkMeanwhileAndStop() = capture("expanded-meanwhile-stop", alternative = meanwhile(), stoppable = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookWithWorkMeanwhileAndStop() = capture("book-meanwhile-stop", fold = true, alternative = meanwhile(), stoppable = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compactStop() = captureStop("compact")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compactStopAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureStop("compact-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expandedStop() = captureStop("expanded")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookStop() = captureStop("book", fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookStop() = captureStop("small-book", fold = true)

    private fun captureStop(
        name: String,
        fold: Boolean = false,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val api = FakeStudyApi()
        val viewModel =
            SessionViewModel(
                StudyOpener(api, api::writeLesson, cache, { "UTC" }),
                StudySessionStore(api, cache) { "UTC" },
                { _, _ -> },
                cache,
                readiness = { _, _ -> error("The lesson is written") },
                generations = { error("Nothing is written") },
            )
        val steps =
            listOf(
                step(0, status = StudyBlock.Status.COMPLETED).copy(title = "Inside the hive"),
                step(1, status = StudyBlock.Status.COMPLETED, kind = StudyBlock.Kind.REVIEW),
                step(2).copy(title = "The waggle dance", estimatedMinutes = 8L, oftenTested = true),
                step(3),
            )

        compose.setContent {
            ZoonkTheme {
                NextStop(
                    viewModel = viewModel,
                    day = day(steps = steps),
                    step = steps[2],
                    goalId = GOAL,
                    asked = false,
                    notWritten = null,
                    alternative = null,
                    refresh = {},
                    onStop = {},
                    navigator = rememberAppNavigator(),
                    warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session),
                )
            }
        }
        shown(fold)
        write("next-stop-$name")
    }

    private fun shown(fold: Boolean) {
        compose.waitForIdle()
        if (fold) {
            folds.unfoldBook(compose.activity, compose::waitForIdle)
        }
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: Boolean = false,
        layoutDirection: LayoutDirection = LayoutDirection.Ltr,
        alternative: DayStep? = null,
        stoppable: Boolean = false,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val api = FakeStudyApi()
        var status = LessonReadiness.Status.GENERATING
        val viewModel =
            SessionViewModel(
                StudyOpener(api, api::writeLesson, cache, { "UTC" }),
                StudySessionStore(api, cache) { "UTC" },
                { _, _ -> },
                cache,
                readiness = { _, _ ->
                    LessonReadiness(
                        alternative = null,
                        generationId = "run-1",
                        setAside = false,
                        status = status,
                        warmUpId = UUID.fromString(WARM_UP_ID),
                    )
                },
                generations = {
                    object : GenerationSource {
                        override fun events(id: String) =
                            flow {
                                emit(GenerationEvent(at = 0, status = "completed", step = "planLesson"))
                                emit(GenerationEvent(at = 6_000, status = "started", step = "writeLesson"))
                                awaitCancellation()
                            }

                        override suspend fun status(id: String) = Generation.Status.RUNNING
                    }
                },
                now = { compose.mainClock.currentTime },
            )
        val warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        var shown by mutableStateOf(step(0, screen = StudyBlock.Screen.SESSION, lessonId = LESSON).copy(title = "Inside the hive"))

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
                    NextStop(
                        viewModel = viewModel,
                        day = day(steps = listOf(shown, step(1).copy(title = "The waggle dance"))),
                        step = shown,
                        goalId = GOAL,
                        asked = true,
                        notWritten = null,
                        alternative = alternative,
                        refresh = { shown = shown.copy(screen = StudyBlock.Screen.LESSON) },
                        onStop = if (stoppable) ({}) else null,
                        navigator = rememberAppNavigator(),
                        warmUps = warmUps,
                    )
                }
            }
        }

        compose.mainClock.advanceTimeBy(1_000)
        shown(fold)
        write("first-lesson-wait-$name")
        compose.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()
        shown(fold)
        write("first-lesson-wait-guessed-$name")
        status = LessonReadiness.Status.READY
        compose.mainClock.advanceTimeBy(5_000)
        shown(fold)
        write("first-lesson-wait-ready-$name")
    }

    private fun write(name: String) {
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    private companion object {
        val LESSON: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f00")
    }
}
