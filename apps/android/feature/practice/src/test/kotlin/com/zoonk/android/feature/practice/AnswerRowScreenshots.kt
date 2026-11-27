package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
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
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyAnswerFeedback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
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
 * Review screenshots of a question's answer rows, one pick and several, written only on demand:
 * `./gradlew :feature:practice:testDebugUnitTest --tests '*AnswerRowScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AnswerRowScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val several =
        blockQuestion(
            "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "O capim capta 20.000 kcal de energia. Sobre a pirâmide de energia dessa cadeia, quais afirmações estão certas?",
            "options" to
                strings(
                    "Os consumidores primários recebem cerca de 2.000 kcal.",
                    "A energia aumenta a cada nível trófico.",
                    "Parte da energia se perde como calor na respiração de cada nível, por isso a pirâmide nunca se inverte.",
                    "Os decompositores ficam no topo.",
                ),
            "select" to "all",
        )

    private val one =
        blockQuestion(
            "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "Uma bicicleta custava 800 reais e teve um desconto de 15%. Quanto ela passou a custar?",
            "options" to
                strings(
                    "680 reais",
                    "785 reais",
                    "120 reais, porque o desconto de 15% sobre 800 reais é o novo preço da bicicleta",
                    "920 reais",
                ),
        )

    private val filler =
        blockQuestion(
            "5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "Which is a star?",
            "options" to strings("Sun", "Venus"),
        )

    private fun show(
        name: String,
        question: JsonObject,
        taps: List<String> = emptyList(),
        check: Boolean = false,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val right = if (question == several) """{"selectedIndexes":[0,2]}""" else """{"selectedIndex":0}"""
        val viewModel = practiceViewModel(cache, blockDetail(listOf(question, filler))) { wrongAnswer(right) }
        val read = viewModel.started()

        rule.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                val navigator = rememberAppNavigator()
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }

        taps.forEach { rule.onNodeWithText(it, substring = true).performClick() }
        if (check) rule.onNodeWithText("Check").performClick()
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureRender(scenario = name).asAndroidBitmap()
        writeRender(File(folder, "$name.png").apply { parentFile?.mkdirs() }, bitmap)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun severalBeforeAPick() = show("several-open", several)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun severalAfterOnePick() = show("several-one-pick", several, taps = listOf("Parte da energia"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun severalAfterOnePickDark() = show("several-one-pick-dark", several, taps = listOf("Parte da energia"), dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun severalAfterOnePickMoreContrast() =
        show("several-one-pick-more-contrast", several, taps = listOf("Parte da energia"), moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2000dp-xxhdpi")
    fun severalAfterOnePickAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show("several-one-pick-font200", several, taps = listOf("Parte da energia"))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi-qwerty")
    fun severalAfterOnePickWithAKeyboard() = show("several-one-pick-keyboard", several, taps = listOf("Parte da energia"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun severalChecked() =
        show("several-checked", several, taps = listOf("Os consumidores", "Os decompositores"), check = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun oneAfterAPick() = show("one-picked", one, taps = listOf("120 reais"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun oneAfterAPickDark() = show("one-picked-dark", one, taps = listOf("120 reais"), dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi-qwerty")
    fun oneAfterAPickWithAKeyboard() = show("one-picked-keyboard", one, taps = listOf("120 reais"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun oneChecked() = show("one-checked", one, taps = listOf("120 reais"), check = true)
}

private fun wrongAnswer(right: String): StudyAnswerFeedback =
    ApiJson.decodeFromString(
        StudyAnswerFeedback.serializer(),
        """{"blank":false,"correctAnswer":$right,"explanation":null,
        |"hyperdrive":{"level":1,"streak":0},"isCorrect":false,"mistakeFixed":false,"pauseSuggested":false,"reinforcementLessons":null,
        |"savedToNotebook":true,"transcript":null,"trap":null,"workedSteps":[]}
        """.trimMargin(),
    )
