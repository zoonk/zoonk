package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
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
 * Review screenshots of a match question in a session's block, each state as the learner taps through it, written only
 * on demand: `./gradlew :feature:practice:testDebugUnitTest --tests '*MatchQuestionScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MatchQuestionScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val exchanges =
        listOf(
            "A: Martedì per me è impossibile. B: Giovedì invece non ho impegni.",
            "A: Sei libero sabato sera? B: Purtroppo lavoro fino alle dieci.",
            "A: Ti va un caffè dopo la lezione? B: Volentieri, ma devo uscire alle cinque.",
            "A: Hai già prenotato il ristorante? B: No, me ne sono dimenticato.",
        )

    /** Shown right to left: the second exchange's reply first, then the first's, the fourth's and the third's. */
    private val replies =
        listOf(
            "Peccato, facciamo domenica a pranzo?",
            "Perfetto, allora ci vediamo giovedì pomeriggio.",
            "Non importa, chiamo io domani mattina.",
            "Va bene, allora andiamo al bar qui di fronte.",
        )

    /** For each exchange, the shown place of its reply. */
    private val key = listOf(1, 0, 3, 2)

    private fun match(learning: Boolean) =
        blockQuestion(
            "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "format" to "matchPairs",
            "question" to "Match each exchange with the reply that follows it.",
            "options" to null,
            "select" to null,
            "left" to strings(*exchanges.toTypedArray()),
            "right" to strings(*replies.toTypedArray()),
            "key" to if (learning) JsonArray(key.map(::JsonPrimitive)) else JsonNull,
            "placement" to !learning,
        )

    private val next =
        blockQuestion(
            "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
            "question" to "Which is a star?",
            "options" to strings("Sun", "Venus"),
        )

    private fun feedback(isCorrect: Boolean): StudyAnswerFeedback =
        ApiJson.decodeFromString(
            StudyAnswerFeedback.serializer(),
            """{"blank":false,"correctAnswer":{"matches":${key.joinToString(",", "[", "]")}},
            |"explanation":"Each reply answers the last line of its exchange.","hyperdrive":{"level":1,"streak":0},"isCorrect":$isCorrect,
            |"mistakeFixed":false,"pauseSuggested":false,"reinforcementLessons":null,"savedToNotebook":${!isCorrect},"transcript":null,
            |"trap":null,"workedSteps":[]}
            """.trimMargin(),
        )

    private var scene by mutableStateOf<Pair<String, @Composable () -> Unit>?>(null)

    private fun start(dark: Boolean) {
        rule.setContent { ZoonkTheme(darkTheme = dark) { scene?.let { (name, content) -> key(name) { content() } } } }
    }

    /** Taps each card in [taps], (left, right) by shown place, a null skipped, then Check when the board waits for it. */
    private fun show(
        name: String,
        learning: Boolean = true,
        taps: List<Pair<Int?, Int?>> = emptyList(),
        check: Boolean = false,
        settle: Boolean = true,
        correct: Boolean = false,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = practiceViewModel(cache, blockDetail(listOf(match(learning), next))) { feedback(correct) }
        val read = viewModel.started()

        rule.mainClock.autoAdvance = true
        scene =
            name to {
                val navigator = rememberAppNavigator()
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        rule.waitForIdle()
        if (!settle) rule.mainClock.autoAdvance = false
        taps.forEach { (left, right) ->
            left?.let { tap(exchanges[it]) }
            right?.let { tap(replies[it]) }
        }
        if (check) {
            rule.onAllNodes(hasText("Check") and isEnabled()).fetchSemanticsNodes().firstOrNull()?.let {
                rule.onNode(hasText("Check") and isEnabled()).performClick()
            }
        }
        if (settle) rule.waitForIdle() else rule.mainClock.advanceTimeBy(FRAME * 4)
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        writeRender(File(folder, "$name.png").apply { parentFile?.mkdirs() }, bitmap)
    }

    private fun tap(text: String) {
        rule.onNode(hasClickAction() and hasText(text, substring = true)).performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(FRAME)
    }

    /** The first exchange stays picked after its miss, so its partner is one tap away. */
    private val oneMissThenSolved = listOf(0 to 0, null to 1, 1 to 0, 2 to 3, 3 to 2)
    private val twoWrongPairs = listOf(0 to 0, 1 to 1, 2 to 3, 3 to 2)

    private fun states(
        suffix: String,
        dark: Boolean,
    ) {
        start(dark)
        show("review-untouched$suffix")
        show("review-selected$suffix", taps = listOf(0 to null))
        show("review-miss$suffix", taps = listOf(0 to 0), settle = false)
        show("review-miss-settled$suffix", taps = listOf(0 to 0))
        show("review-midway$suffix", taps = listOf(0 to 1, 1 to 0))
        show("review-two-wrong-pairs$suffix", taps = twoWrongPairs)
        show("review-two-wrong-pairs-checked$suffix", taps = twoWrongPairs, check = true)
        show("review-checked-after-a-miss$suffix", taps = oneMissThenSolved, check = true)
        show("review-checked-clean$suffix", taps = listOf(0 to 1, 1 to 0, 2 to 3, 3 to 2), check = true, correct = true)
        show("held-selected$suffix", learning = false, taps = listOf(0 to null))
        show("held-all-paired$suffix", learning = false, taps = twoWrongPairs)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = states("", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = states("-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        start(dark = false)
        show("review-midway-font200", taps = listOf(0 to 1, 1 to 0))
    }

    private companion object {
        const val FRAME = 16L
    }
}
