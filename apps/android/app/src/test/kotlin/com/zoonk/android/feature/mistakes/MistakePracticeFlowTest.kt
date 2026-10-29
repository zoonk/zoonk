package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
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
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MistakePracticeFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun closingAfterAnAnswerEndsThePracticeAndCountsIt() {
        val api =
            FakeMistakesApi(
                practice(
                    practiceEntry(FIRST_MISTAKE, practiceQuestion("3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")),
                    practiceEntry(
                        SECOND_MISTAKE,
                        practiceQuestion("4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b", "question" to "Which is a star?"),
                    ),
                ),
                answer = { practiceFeedback(fixed = true, fixedMistakeIds = listOf(FIRST_MISTAKE)) },
                finish = { completion(correct = 1, total = 1) },
            )
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = practiceViewModel(cache, api)
        viewModel.started()

        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }

        rule.onNodeWithText("Last time you answered: Moon").assertIsDisplayed()
        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Check").performClick()
        rule.onNodeWithText("Mistake fixed. It leaves your notebook.").assertIsDisplayed()

        rule.onNodeWithContentDescription("End practice. What you answered counts.").performClick()

        rule.onNodeWithText("Practice done").assertIsDisplayed()
        rule.onNodeWithText("1 mistake fixed").assertIsDisplayed()
        rule.onNodeWithText("Back").assertIsDisplayed()
        assertEquals(
            1,
            api.finishes
                .single()
                .answerIds.size,
        )
    }
}
