package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.practice.block.QuestionBlockContent
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.opening
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class QuestionBlockFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val studyApi = FakeStudyApi()
    private val left = mutableListOf<AppRoute>()

    private fun cache() =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )

    private fun show(
        questions: List<JsonObject> =
            listOf(
                blockQuestion(FIRST, "question" to "Which is a planet?", "options" to strings("Mars", "Moon")),
                blockQuestion(SECOND, "question" to "Which is a star?", "options" to strings("Sun", "Venus")),
            ),
    ) {
        val detail = blockDetail(questions)
        val viewModel = practiceViewModel(cache(), detail) { studyFeedback(isCorrect = true, explanation = "Mars orbits the Sun.") }
        val read = viewModel.started()

        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }
    }

    private fun playToTheEnd() {
        val cache = cache()
        val opener =
            StudyOpener(studyApi, studyApi::writeLesson, cache, timeZone = { "UTC" })
        val detail = blockDetail(listOf(blockQuestion(FIRST, "question" to "Which is a planet?", "options" to strings("Mars", "Moon"))))
        val viewModel = practiceViewModel(cache, detail, steps = opener, completion = decodeFixture("study-block-completion"))

        rule.setContent {
            ZoonkTheme {
                QuestionBlockContent(viewModel, AppContainer.preview(rule.activity), rememberAppNavigator(), onClose = {}, onLeave = {
                    left +=
                        it
                })
            }
        }
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Check").performClick()
        rule.onNodeWithText("Continue").performClick()
        rule.waitUntil { rule.onAllNodesWithText("Stop for today").fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun aPickIsCheckedThenContinueShowsTheNextQuestion() {
        show()

        rule.onNodeWithText("Check").assertIsNotEnabled()
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Check").assertIsEnabled().performClick()
        rule.waitForIdle()

        rule.onNodeWithText("Correct!").assertExists()
        rule.onNodeWithText("Mars orbits the Sun.").assertExists()
        rule.onNodeWithText("Continue").performClick()
        rule.waitForIdle()

        rule.onNodeWithText("Which is a star?").assertExists()
        rule.onNodeWithText("Check").assertIsNotEnabled()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun aPassageBesideTheQuestionKeepsCheckUnderTheQuestion() {
        show(listOf(blockQuestion(FIRST, "question" to "Which is a planet?", "options" to strings("Mars", "Moon"), "set" to PASSAGE)))

        val check = rule.onNodeWithText("Check").getBoundsInRoot()
        val passage = rule.onNodeWithText("Recife grew", substring = true, useUnmergedTree = true).getBoundsInRoot()
        assertTrue("Check ends at ${check.right}, the passage starts at ${passage.left}", check.right < passage.left)
    }

    @Test
    fun stopForTodayAtABlocksEndStopsTheSessionAndOpensItsStoppedSummary() {
        playToTheEnd()

        rule.onNodeWithText("Stop for today").performClick()
        rule.waitUntil { left.isNotEmpty() }

        assertEquals(listOf(UUID.fromString(PRACTICE_SESSION)), studyApi.stopped)
        assertEquals(listOf<AppRoute>(AppRoute.Session(sessionId = PRACTICE_SESSION, stopped = true)), left)
    }

    @Test
    fun continueAtABlocksEndOpensTheSessionsNextBlock() {
        studyApi.openings = listOf(opening("session", "blockId" to NEXT_BLOCK))
        playToTheEnd()

        rule.onNodeWithText("Continue").performClick()
        rule.waitUntil { left.isNotEmpty() }

        assertEquals(listOf<AppRoute>(AppRoute.QuestionBlock(PRACTICE_SESSION, NEXT_BLOCK)), left)
        assertEquals(1, studyApi.targets.size)
        assertEquals(emptyList<UUID>(), studyApi.stopped)
    }

    private companion object {
        const val FIRST = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val NEXT_BLOCK = "6b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
    }
}
