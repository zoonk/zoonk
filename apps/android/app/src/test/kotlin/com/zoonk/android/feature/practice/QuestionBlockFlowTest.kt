package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.block.BlockKey
import com.zoonk.android.feature.practice.block.QuestionBlockApi
import com.zoonk.android.feature.practice.block.QuestionBlockStore
import com.zoonk.android.feature.practice.block.QuestionBlockViewModel
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import com.zoonk.api.models.StudySessionSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class QuestionBlockFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun show() {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val detail =
            blockDetail(
                listOf(
                    blockQuestion(FIRST, "question" to "Which is a planet?", "options" to strings("Mars", "Moon")),
                    blockQuestion(SECOND, "question" to "Which is a star?", "options" to strings("Sun", "Venus")),
                ),
            )
        val viewModel = practiceViewModel(cache, detail) { studyFeedback(isCorrect = true, explanation = "Mars orbits the Sun.") }
        val read = viewModel.started()

        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }
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

    private companion object {
        const val FIRST = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
    }
}
