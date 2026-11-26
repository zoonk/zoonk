package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyAnswerFeedback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** On a short phone, a match's verdict scrolls into sight whole, and no title or card is left sliced at the top. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MatchVerdictRevealTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val exchanges =
        listOf(
            "A: Martedì per me è impossibile. B: Giovedì invece non ho impegni.",
            "A: Sei libero sabato sera? B: Purtroppo lavoro fino alle dieci.",
            "A: Ti va un caffè dopo la lezione? B: Volentieri, ma devo uscire alle cinque.",
        )
    private val replies =
        listOf(
            "Peccato, facciamo domenica a pranzo?",
            "Perfetto, allora ci vediamo giovedì pomeriggio.",
            "Va bene, allora andiamo al bar qui di fronte.",
        )
    private val key = listOf(1, 0, 2)
    private val title = "Match each exchange with the reply that follows it."

    @Test
    @Config(qualifiers = "w390dp-h560dp-xxhdpi")
    fun theVerdictShowsWholeAndNothingAboveItIsSliced() {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val question =
            blockQuestion(
                "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
                "format" to "matchPairs",
                "question" to title,
                "options" to null,
                "select" to null,
                "left" to strings(*exchanges.toTypedArray()),
                "right" to strings(*replies.toTypedArray()),
                "key" to JsonArray(key.map(::JsonPrimitive)),
                "placement" to false,
            )
        val viewModel = practiceViewModel(cache, blockDetail(listOf(question))) { feedback() }
        val read = viewModel.started()
        rule.setContent {
            ZoonkTheme {
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator(), onClose = {}) }
            }
        }
        rule.waitForIdle()

        // A miss first, then every pair.
        listOf(exchanges[0], replies[0], replies[1], exchanges[1], replies[0], exchanges[2], replies[2]).forEach { text ->
            rule.onNode(hasClickAction() and hasText(text)).performScrollTo().performClick()
            rule.mainClock.advanceTimeBy(CUE)
        }
        rule.mainClock.advanceTimeBy(SCROLL)
        rule.waitForIdle()

        val page = rule.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)).getUnclippedBoundsInRoot()
        val verdict = rule.onAllNodes(hasText("Not quite"))[0].getUnclippedBoundsInRoot()
        assertTrue("the verdict ends at ${verdict.bottom}, under the page's ${page.bottom}", verdict.bottom <= page.bottom)

        (listOf(title) + exchanges + replies).forEach { text ->
            val nodes = rule.onAllNodes(hasText(text, substring = true) or hasContentDescription(text, substring = true))
            repeat(nodes.fetchSemanticsNodes().size) { index ->
                val part = nodes[index].getUnclippedBoundsInRoot()
                val sliced = part.top < page.top - EDGE && part.bottom > page.top + EDGE
                assertTrue("\"$text\" is cut at the page's top: ${part.top}..${part.bottom} under ${page.top}", !sliced)
            }
        }
    }

    private fun feedback(): StudyAnswerFeedback =
        ApiJson.decodeFromString(
            StudyAnswerFeedback.serializer(),
            """{"blank":false,"correctAnswer":{"matches":${key.joinToString(",", "[", "]")}},
            |"explanation":"Each reply answers the last line of its exchange.","hyperdrive":{"level":1,"streak":0},"isCorrect":false,
            |"mistakeFixed":false,"pauseSuggested":false,"reinforcementLessons":null,"savedToNotebook":true,"transcript":null,
            |"trap":null,"workedSteps":[]}
            """.trimMargin(),
        )

    private companion object {
        const val CUE = 700L
        const val SCROLL = 2000L
        val EDGE = 1.dp
    }
}
