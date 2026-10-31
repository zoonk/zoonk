package com.zoonk.android.feature.player.language

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
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.feature.player.FakeLessonPlayerApi
import com.zoonk.android.feature.player.LESSON_ID
import com.zoonk.android.feature.player.LessonEnding
import com.zoonk.android.feature.player.LessonPlayer
import com.zoonk.android.feature.player.LessonPlayerExits
import com.zoonk.android.feature.player.LessonPlayerStore
import com.zoonk.android.feature.player.LessonPlayerViewModel
import com.zoonk.android.feature.player.LocalLessonSpeech
import com.zoonk.android.feature.player.RUN_ID
import com.zoonk.android.feature.player.TodayChoices
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
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

/**
 * Review screenshots of the language screens, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*LanguageStepsScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LanguageStepsScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val temporary = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    private val screens: List<Pair<String, List<LessonStep>>> =
        listOf(
            "vocabulary" to listOf(vocabulary("s")),
            "alphabet" to listOf(alphabet("s")),
            "translation" to listOf(translation("s")),
            "multiple-choice" to listOf(multipleChoice("s")),
            "reading" to listOf(reading("s")),
            "listening" to listOf(listening("s", audioUrl = "https://blob.test/s.mp3")),
            "fill-blank" to listOf(fillBlank("s")),
            "match-columns" to listOf(matchColumns("s")),
        )

    private fun at(
        steps: List<LessonStep>,
        vararg actions: LessonAction,
    ): LessonPlayerState {
        val started =
            reduce(
                LessonPlayerState.initial(LESSON_ID, steps, now = 0),
                LessonAction.RunStarted(RUN_ID, emptyList(), HyperdriveStart(emptySet(), 0), Instant.parse("2026-10-28T10:00:00Z")),
                0,
            )
        return actions.fold(started) { state, action -> reduce(state, action, 0) }
    }

    private fun checked(
        answer: LessonAnswer,
        right: Boolean,
        feedback: String,
    ) = arrayOf(
        LessonAction.SelectAnswer("s", answer),
        LessonAction.CheckStarted("s"),
        LessonAction.CheckResolved(
            "s",
            checkResult(right, feedback).toStepResult(null).copy(correctAnswer = if (right) null else "Yo veo un gato."),
            counts = true,
        ),
    )

    private val states: List<Triple<String, List<LessonStep>, Array<LessonAction>>> =
        screens.map { (name, steps) -> Triple(name, steps, emptyArray<LessonAction>()) } +
            listOf(
                Triple(
                    "translation-picked",
                    listOf(translation("s")),
                    arrayOf(LessonAction.SelectAnswer("s", LessonAnswer.Translation("w-1"))),
                ),
                Triple(
                    "reading-wrong",
                    listOf(reading("s")),
                    checked(LessonAnswer.Reading(listOf("veo", "Yo", "un", "gato.")), false, "The subject comes first."),
                ),
                Triple("fill-blank-right", listOf(fillBlank("s")), checked(LessonAnswer.FillBlank(listOf("pay")), true, "You pay rent.")),
                Triple(
                    "multiple-choice-wrong",
                    listOf(multipleChoice("s")),
                    checked(LessonAnswer.MultipleChoice("sofa"), false, "It's on the bed."),
                ),
            )

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(temporary.newFolder(), scope)
        var index by mutableIntStateOf(0)
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }

        compose.setContent {
            val (_, steps, actions) = states[index]
            val lesson = playable(steps).copy(targetLanguage = "es")
            val viewModel =
                viewModel(key = "screen-$index") {
                    LessonPlayerViewModel(
                        LESSON_ID,
                        null,
                        null,
                        LessonPlayerStore(FakeLessonPlayerApi(LessonLoad.Ready(lesson)), cache),
                        cache,
                        session,
                        TodayChoices(drafts),
                        drafts,
                    )
                }
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState(), LocalLessonSpeech provides previewSpeech()) {
                    key(index) { LessonPlayer(lesson, at(steps, *actions), LessonEnding(), viewModel, exits, rememberAppNavigator()) }
                }
            }
        }
        states.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            write("${states[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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
