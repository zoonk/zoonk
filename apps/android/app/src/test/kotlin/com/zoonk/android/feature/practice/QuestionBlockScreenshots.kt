package com.zoonk.android.feature.practice

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
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
 * `./gradlew :app:testDebugUnitTest --tests '*QuestionBlockScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class QuestionBlockScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val passage =
        JsonObject(
            mapOf(
                "count" to JsonPrimitive(2),
                "id" to JsonPrimitive("6b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"),
                "kind" to JsonPrimitive("text"),
                "listening" to kotlinx.serialization.json.JsonNull,
                "position" to JsonPrimitive(0),
                "source" to JsonPrimitive("Adapted from IBGE"),
                "text" to
                    JsonPrimitive(
                        "Recife grew along its rivers. Merchants built warehouses where the tide reached, and the port tied the city to the sea for three centuries.",
                    ),
                "title" to JsonPrimitive("The port of Recife"),
                "visual" to kotlinx.serialization.json.JsonNull,
            ),
        )

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
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletPassageBeside() {
        show("tablet-passage", questions = arrayOf(planet("set" to passage), next))
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

    private fun showDone(name: String) {
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
        rule.setContent { ZoonkTheme { BlockFinished(completion, review = false, AppContainer.preview(rule.activity), onClose = {}) } }
        rule.mainClock.advanceTimeBy(10_000)
        write(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneDone() = showDone("phone-block-done")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletDone() = showDone("tablet-block-done")

    private fun write(name: String) {
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
