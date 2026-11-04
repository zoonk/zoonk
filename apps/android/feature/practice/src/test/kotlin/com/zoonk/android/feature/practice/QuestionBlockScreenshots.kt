package com.zoonk.android.feature.practice

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.practice.block.BlockFinished
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
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
 * Review screenshots of the question block runner, written only on demand:
 * `./gradlew :feature:practice:testDebugUnitTest --tests '*QuestionBlockScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class QuestionBlockScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val timeMachine =
        JsonObject(
            mapOf(
                "answer" to JsonPrimitive("Moon"),
                "answeredAt" to JsonPrimitive("2026-10-08T12:00:00Z"),
                "isCorrect" to JsonPrimitive(false),
            ),
        )

    private val timed =
        JsonObject(
            mapOf(
                "kind" to JsonPrimitive("timed"),
                "lesson" to kotlinx.serialization.json.JsonNull,
                "timeLimitSeconds" to JsonPrimitive(45),
            ),
        )

    private fun show(
        name: String,
        dark: Boolean = false,
        check: Boolean = false,
        open: Boolean = false,
        vararg questions: JsonObject,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel =
            practiceViewModel(cache, blockDetail(questions.toList())) {
                studyFeedback(isCorrect = false, explanation = "Mars is the fourth planet; the Moon orbits Earth.", streak = 0)
            }
        val read = viewModel.started()

        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                val navigator = rememberAppNavigator()
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }

        if (open) unfold()
        if (check) {
            rule.onNodeWithText("Moon", substring = true).performClick()
            rule.onNodeWithText("Check").performClick()
            rule.waitForIdle()
        }
        write(name)
    }

    private fun planet(vararg fields: Pair<String, Any?>) =
        blockQuestion(
            "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "Which of these is a planet?",
            "options" to strings("Mars", "Moon"),
            *fields,
        )

    private val next =
        blockQuestion(
            "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "Which is a star?",
            "options" to strings("Sun", "Venus"),
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() {
        show("phone-answering", questions = arrayOf(planet("timeMachine" to timeMachine), next))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneChecked() {
        show("phone-checked", check = true, questions = arrayOf(planet("timeMachine" to timeMachine), next))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneTimedDark() {
        show(
            "phone-timed-dark",
            dark = true,
            questions =
                arrayOf(
                    planet(
                        "drill" to timed,
                        "mistakeId" to "7b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
                    ),
                    next,
                ),
        )
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-font200-checked", check = true, questions = arrayOf(planet(), next))
    }

    private val typed =
        blockQuestion(
            "5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "format" to "typed",
            "question" to "What's the chemical symbol for sodium?",
            "options" to null,
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTyped() {
        show("phone-typed", questions = arrayOf(typed, next))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTypedLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-font200-typed", questions = arrayOf(typed, next))
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xxhdpi")
    fun bookSpread() {
        show("book-passage", open = true, questions = arrayOf(planet("set" to PASSAGE), next))
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xxhdpi")
    fun bookSpreadChecked() {
        show("book-checked", check = true, open = true, questions = arrayOf(planet("timeMachine" to timeMachine), next))
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xxhdpi")
    fun bookSpreadStatement() {
        show("book-statement", open = true, questions = arrayOf(statement, next))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePassage() {
        show("phone-passage", questions = arrayOf(planet("set" to PASSAGE), next))
    }

    private val statement =
        blockQuestion(
            "5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "format" to "trueFalse",
            "question" to "Mars is the fourth planet from the Sun.",
            "options" to null,
        )

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletPassageBeside() {
        show("tablet-passage", questions = arrayOf(planet("set" to PASSAGE), next))
    }

    private val missions =
        JsonArray(
            listOf("practice" to "done", "review" to "todo").map { (kind, status) ->
                JsonObject(
                    mapOf(
                        "done" to JsonPrimitive(if (status == "done") 1 else 0),
                        "kind" to JsonPrimitive(kind),
                        "status" to JsonPrimitive(status),
                        "total" to JsonPrimitive(1),
                    ),
                )
            },
        )

    // Android tells a listener that starts after the fold about it; window-testing doesn't, so a frame
    // rebuilt as the fold drops the passage's aside hears it again.
    private fun unfold() {
        repeat(2) {
            rule.waitForIdle()
            folds.overrideWindowLayoutInfo(
                TestWindowLayoutInfo(
                    listOf(
                        FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL),
                    ),
                ),
            )
        }
        rule.waitForIdle()
    }

    private fun showDone(
        name: String,
        fold: Boolean = false,
        dark: Boolean = false,
        direction: LayoutDirection = LayoutDirection.Ltr,
    ) {
        val completion: StudyBlockCompletion =
            com.zoonk.android.feature.session.decodeFixture(
                "study-block-completion",
                "missions" to missions,
                "completedMissions" to JsonArray(listOf(JsonPrimitive("practice"))),
                "reached" to
                    JsonObject(
                        mapOf(
                            "energy" to JsonPrimitive(64),
                            "level" to JsonObject(mapOf("color" to JsonPrimitive("yellow"), "level" to JsonPrimitive(3))),
                        ),
                    ),
            )
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = practiceViewModel(cache, blockDetail(emptyList()))
        rule.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = dark) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    BlockFinished(
                        completion,
                        review = false,
                        AppContainer.preview(rule.activity),
                        viewModel,
                        onClose = {},
                    )
                }
            }
        }
        rule.mainClock.advanceTimeBy(10_000)
        if (fold) unfold()
        write(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneDone() = showDone("phone-block-done")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookDone() = showDone("book-block-done", fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookDone() = showDone("small-book-block-done", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDoneDarkMoreContrast() = showDone("book-block-done-dark-more-contrast", fold = true, dark = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookDoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        showDone("book-block-done-font200", fold = true)
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookDoneRightToLeft() = showDone("book-block-done-rtl", fold = true, direction = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w700dp-h840dp-xhdpi")
    fun mediumDone() = showDone("medium-block-done")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletDone() = showDone("tablet-block-done")

    private fun write(name: String) {
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
