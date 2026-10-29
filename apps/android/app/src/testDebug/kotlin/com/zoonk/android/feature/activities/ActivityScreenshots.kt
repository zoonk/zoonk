package com.zoonk.android.feature.activities

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.FakeLessonPlayerApi
import com.zoonk.android.feature.player.LESSON_ID
import com.zoonk.android.feature.player.LessonEnding
import com.zoonk.android.feature.player.LessonPlayer
import com.zoonk.android.feature.player.LessonPlayerExits
import com.zoonk.android.feature.player.LessonPlayerStore
import com.zoonk.android.feature.player.LessonPlayerViewModel
import com.zoonk.android.feature.player.TodayChoices
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.android.feature.player.playable
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import kotlin.time.Instant

/** A checked screen shows [answer] graded [isCorrect] against the fixture's expected end state. */
private class Shot(
    val fixture: String,
    val answer: ActivityAnswer?,
    val isCorrect: Boolean,
)

private fun right(fixture: String) = Shot(fixture, ActivityFixtures.rightAnswer(fixture), isCorrect = true)

private val shots =
    listOf(
        Shot("guessReveal", numericAnswer(40.0), isCorrect = false),
        right("guessReveal.cited"),
        right("beforeAfter"),
        right("chartReader"),
        right("decisionTree"),
        right("findError"),
        right("stepSolver"),
        right("patternTable"),
        right("dialogueSimulator"),
    )

/**
 * Review screenshots of each activity template, answering and checked, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*ActivityScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ActivityScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val temporary = TemporaryFolder()

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
    @Config(qualifiers = "w411dp-h2400dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun tablet() = capture("tablet")

    private fun states(shot: Shot): List<Pair<String, LessonPlayerState>> {
        val step = ActivityFixtures.step(shot.fixture, id = "act")
        val started =
            reduce(
                LessonPlayerState.initial(LESSON_ID, listOf(step), now = 0),
                LessonAction.RunStarted("run", emptyList(), HyperdriveStart(emptySet(), 0), Instant.parse("2026-10-29T10:00:00Z")),
                0,
            )
        val answered = shot.answer?.let { reduce(started, LessonAction.SelectAnswer("act", LessonAnswer.Activity(it)), 0) } ?: started
        val checked =
            listOf(
                LessonAction.CheckStarted("act"),
                LessonAction.CheckResolved(
                    "act",
                    checkResult(shot.isCorrect, expected = ActivityFixtures.expected(shot.fixture)).toStepResult(null),
                    counts = true,
                ),
            ).fold(answered) { state, action -> reduce(state, action, 0) }
        return listOf("${shot.fixture}-answering" to started, "${shot.fixture}-checked" to checked)
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(temporary.newFolder(), scope)
        val screens =
            shots.flatMap { shot ->
                states(shot).map { (state, player) ->
                    Triple(state, playable(listOf(ActivityFixtures.step(shot.fixture, id = "act"))), player)
                }
            }
        val viewModel =
            LessonPlayerViewModel(
                LESSON_ID,
                null,
                null,
                LessonPlayerStore(FakeLessonPlayerApi(LessonLoad.Ready(screens.first().second)), cache),
                cache,
                session,
                TodayChoices(drafts),
                drafts,
            )
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }
        var index by mutableIntStateOf(0)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    key(index) {
                        val (_, lesson, state) = screens[index]
                        LessonPlayer(lesson, state, LessonEnding(), viewModel, exits, rememberAppNavigator())
                    }
                }
            }
        }
        screens.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            write("${screens[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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
}
