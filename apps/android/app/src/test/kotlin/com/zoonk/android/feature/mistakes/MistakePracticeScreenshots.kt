package com.zoonk.android.feature.mistakes

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
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
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
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
 * Review screenshots of mistakes practice, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*MistakePracticeScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MistakePracticeScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val lesson =
        JsonObject(
            mapOf(
                "id" to JsonPrimitive("cb4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"),
                "ideas" to
                    JsonArray(
                        listOf(
                            "A planet orbits a star and has cleared its path.",
                            "Moons orbit planets, not stars.",
                            "Mars is the fourth planet from the Sun.",
                        ).map(::JsonPrimitive),
                    ),
                "title" to JsonPrimitive("What makes a planet"),
            ),
        )

    private val passage =
        JsonObject(
            mapOf(
                "count" to JsonPrimitive(1),
                "id" to JsonPrimitive("6b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"),
                "kind" to JsonPrimitive("text"),
                "listening" to JsonNull,
                "position" to JsonPrimitive(0),
                "source" to JsonPrimitive("Adapted from IBGE"),
                "text" to
                    JsonPrimitive(
                        "Recife grew along its rivers. Merchants built warehouses where the tide reached, and the port tied the city to the sea for three centuries.",
                    ),
                "title" to JsonPrimitive("The port of Recife"),
                "visual" to JsonNull,
            ),
        )

    private fun planet(vararg fields: Pair<String, Any?>) =
        practiceQuestion("3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b", "question" to "Which is a planet?", *fields)

    private val similar =
        practiceQuestion(
            "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "Which of these orbits the Sun directly?",
            "options" to JsonArray(listOf("Venus", "Titan").map(::JsonPrimitive)),
        )

    private fun show(
        name: String,
        drill: JsonObject = drill("retry"),
        dark: Boolean = false,
        vararg questions: JsonObject = arrayOf(planet(), similar),
        play: () -> Unit = {},
    ) {
        val api =
            FakeMistakesApi(
                practice(practiceEntry(FIRST_MISTAKE, *questions, drill = drill)),
                answer = { practiceFeedback(isCorrect = true, fixed = true, fixedMistakeIds = listOf(FIRST_MISTAKE)) },
                finish = { completion(correct = 1, total = 2) },
            )
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = practiceViewModel(cache, api)
        viewModel.started()

        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                val navigator = rememberAppNavigator()
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }
        play()
        rule.waitForIdle()
        write(name)
    }

    private fun check() {
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Check").performClick()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() {
        show("phone-answering")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneChecked() {
        show("phone-checked", play = ::check)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneIdeas() {
        show("phone-ideas", drill = drill("reteach", lesson = lesson))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNoGuessing() {
        show("phone-no-guessing", drill = drill("noGuessing"))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneTimedDark() {
        show("phone-timed-dark", drill = drill("timed", seconds = 45), dark = true)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneDone() {
        show("phone-done") {
            check()
            rule.onNodeWithContentDescription("End practice. What you answered counts.").performClick()
        }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLargeFontChecked() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-font200-checked", play = ::check)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletPassageBeside() {
        show("tablet-passage", questions = arrayOf(planet("set" to passage), similar))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNothingToPractice() {
        rule.setContent { ZoonkTheme { NothingToPractice(onClose = {}) } }
        write("phone-nothing")
    }

    private fun write(name: String) {
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
