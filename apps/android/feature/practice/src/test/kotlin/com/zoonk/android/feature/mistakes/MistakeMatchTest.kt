package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.QuestionAnswer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A learning match in the notebook checks each pair and sends itself, with its misses, once the last pair is made. */
@RunWith(AndroidJUnit4::class)
class MistakeMatchTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun theLastPairSendsTheBoardWithItsMissesInOrder() {
        val match =
            practiceQuestion(
                "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
                "format" to "matchPairs",
                "question" to "Match each word with its meaning.",
                "options" to null,
                "select" to null,
                "left" to JsonArray(listOf("il martedì", "domani").map(::JsonPrimitive)),
                "right" to JsonArray(listOf("tomorrow", "Tuesday").map(::JsonPrimitive)),
                "key" to JsonArray(listOf(1, 0).map(::JsonPrimitive)),
            )
        val api = FakeMistakesApi(practice(practiceEntry(FIRST_MISTAKE, match)), answer = { practiceFeedback(isCorrect = false) })
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = practiceViewModel(cache, api)
        viewModel.started()

        rule.setContent {
            ZoonkTheme {
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator()) }
            }
        }

        fun tap(text: String) = rule.onNode(hasClickAction() and hasText(text)).performScrollTo().performClick()

        tap("il martedì")
        tap("tomorrow")
        rule.onNodeWithText("Continue").assertIsNotEnabled()
        // The first card stays picked after a miss, so its partner is one tap away.
        tap("Tuesday")
        tap("domani")
        tap("tomorrow")
        rule.waitForIdle()

        val sent = ApiJson.encodeToJsonElement(QuestionAnswer.serializer(), api.answers.single().answer)
        assertEquals(ApiJson.parseToJsonElement("""{"matches":[1,0],"misses":[{"left":0,"right":0}]}"""), sent)
        rule.onNodeWithText("Continue").assertIsEnabled()
        rule.onNodeWithText("You first matched il martedì with tomorrow.").assertExists()
    }
}
