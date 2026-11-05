package com.zoonk.android.feature.pronunciation

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.feature.ceremonies.SessionCeremony
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PronunciationAnswerGrade
import com.zoonk.api.models.PronunciationRoundResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
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
 * Review screenshots of a pronunciation round, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*PronunciationScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PronunciationScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

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

    @Test
    @Config(qualifiers = "w700dp-h840dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = BOOK)
    fun book() = capture("book", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDarkMoreContrast() = capture("book-dark-more-contrast", dark = true, moreContrast = true, fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("book-font200", fold = true)
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookRightToLeft() = capture("book-rtl", fold = true, layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun galaxyFold() = capture("galaxy-fold", fold = true)

    private val comesBack: PronunciationAnswerGrade =
        ApiJson.decodeFromString(
            PronunciationAnswerGrade.serializer(),
            """{"attemptId":"00000000-0000-4000-8000-000000000099","isCorrect":false,"nextReviewAt":"2026-11-02T12:00:00Z","transcript":"ola"}""",
        )

    private val words =
        arrayOf(
            word(1, "hola", respelling = "OH-lah", tip = "The **h** is silent: start the word on the vowel."),
            word(2, "gracias", respelling = "GRAH-syahs"),
        )

    private val states: List<State> =
        listOf(
            State("word"),
            State("wrong", listOf(comesBack)),
            State("right", listOf(grade(isCorrect = true))),
            State("no-speech", listOf(null)),
            State("practice-done", listOf(grade(isCorrect = true)), skips = 2),
            State("practice-done-belt", listOf(grade(isCorrect = true)), skips = 2, result = BELT),
            State("nothing-said", skips = 2),
            State("no-words", empty = true),
        )

    private class State(
        val name: String,
        val grades: List<PronunciationAnswerGrade?> = emptyList(),
        val skips: Int = 0,
        val empty: Boolean = false,
        val result: PronunciationRoundResult = RESULT,
    )

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: Boolean = false,
        layoutDirection: LayoutDirection? = null,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        var index by mutableIntStateOf(0)
        val models =
            states.map { state ->
                val api =
                    FakePronunciationApi(if (state.empty) reviews() else reviews(*words), *state.grades.toTypedArray()).apply {
                        result = state.result
                    }
                val store = PronunciationStore(api, cache) { "UTC" }
                PronunciationViewModel(compose.activity).apply { start(GOAL_ID, api.words, store) }.also { model ->
                    runBlocking {
                        state.grades.forEach { _ -> model.round!!.record(model.round!!.attempt, RECORDING) }
                        repeat(state.skips) { model.round!!.next() }
                    }
                }
            }

        val app = AppContainer.preview(compose.activity)
        compose.setContent {
            val model = models[index]
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalLayoutDirection provides (layoutDirection ?: LocalLayoutDirection.current),
                ) {
                    key(index) {
                        PronunciationRoundScreen(
                            model.round!!,
                            model,
                            previewSpeech(),
                            rememberAppNavigator(),
                            buddy = null,
                            ceremony = { milestone, onClose -> SessionCeremony(app, milestone, onClose) },
                        )
                    }
                }
            }
        }
        if (fold) compose.unfoldBook(folds)
        states.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            // A milestone's ceremony opens in a dialog's window, which onRoot() doesn't capture.
            val shown = if (compose.onAllNodes(isDialog()).fetchSemanticsNodes().isEmpty()) compose.onRoot() else compose.onNode(isDialog())
            write("${states[screen].name}-$name", shown.captureRender().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "pronunciation-$name.png")
        file.parentFile?.mkdirs()
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        const val BOOK = "w852dp-h883dp-xhdpi"

        val BELT: PronunciationRoundResult =
            ApiJson.decodeFromString(
                PronunciationRoundResult.serializer(),
                """
                {"brainPower":2,"certificates":[],"correct":1,"total":1,"missionMoment":null,"reached":{"energy":null,"level":{"color":"yellow","level":1}},
                 "ceremony":{"beltStartBrainPower":2500,"earnedAt":"2026-11-04T12:00:00Z","id":"00000000-0000-4000-8000-000000000077",
                  "key":"yellow","kind":"belt","shownAt":null}}
                """.trimIndent(),
            )
    }
}
