package com.zoonk.android.feature.player

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Generation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
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
 * Review screenshots of a goal's first lesson's wait with its guesses, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*LessonWaitScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * The learner guesses while the lesson is written, and it's ready before they're done.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonWaitScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compact() = capture("compact")

    /** A lesson that isn't a goal's first has no deck, and its wait stays as it was. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compactWithoutDeck() = capture("without-deck-compact", deck = false)

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
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun twiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("font200")
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        deck: Boolean = true,
    ) {
        val outline = LessonOutline("lesson-1", "Inside the hive", "Who does what among the queen, the workers and the drones.", 5)
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val api =
            FakeLessonPlayerApi(LessonLoad.NotGenerated(outline)).apply {
                readinessStates += "generating"
                warmUpId = WARM_UP_ID.takeIf { deck }
            }
        val events = MutableSharedFlow<GenerationEvent>(replay = 10)
        events.tryEmit(GenerationEvent(at = 0, status = "completed", step = "planLesson"))
        events.tryEmit(GenerationEvent(at = 6_000, status = "started", step = "writeLesson"))
        val generations =
            object : GenerationSource {
                override fun events(id: String) = events

                override suspend fun status(id: String) = Generation.Status.RUNNING
            }
        val viewModel = LessonWritingViewModel("lesson-1", LessonPlayerStore(api, cache), { _, _ -> }, { generations }, cache, session)
        val warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }

        viewModel.open()
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                LessonWaitingScreen(outline, viewModel, warmUps, exits, readLesson = {})
            }
        }
        compose.waitForIdle()
        write("lesson-wait-$name")
        if (!deck) return

        compose.onNodeWithText("To hide the bees' alarm scent").performClick()
        events.tryEmit(GenerationEvent(at = 40_000, status = "completed", step = "lessonReady"))
        compose.waitForIdle()
        write("lesson-wait-ready-$name")
    }

    private fun write(name: String) {
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }
}
