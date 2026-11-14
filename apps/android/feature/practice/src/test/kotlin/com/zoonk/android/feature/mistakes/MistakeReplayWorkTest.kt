package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
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
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MistakeReplayWorkTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun replay(
        id: String,
        kind: String = "activity",
        content: JsonObject =
            ApiJson
                .encodeToJsonElement(
                    ActivityStepContent.serializer(),
                    ActivityFixtures.content("patternTable"),
                ).jsonObject,
    ): JsonObject {
        val entry = fixture("mistake-practice-lesson-entry", "mistakeId" to id)
        val lesson = entry.getValue("lesson").jsonObject
        val step = lesson.getValue("step").jsonObject
        val original = JsonObject(step + mapOf("id" to JsonPrimitive(id), "kind" to JsonPrimitive(kind), "content" to content))
        return JsonObject(entry + ("lesson" to JsonObject(lesson + ("step" to original))))
    }

    private fun run(vararg entries: JsonObject): MistakePracticeViewModel {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = practiceViewModel(cache, FakeMistakesApi(practice(*entries)))
        viewModel.started()
        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, AppContainer.preview(rule.activity), navigator) }
            }
        }
        return viewModel
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    @Test
    fun theNextOriginalDoesNotInheritThePreviousPatternsAssignments() {
        val viewModel = run(replay(FIRST_MISTAKE), replay(SECOND_MISTAKE))

        tap("-éis")
        tap("-en")
        rule.onNodeWithText("Check").performClick()
        rule.onNodeWithText("Continue").performClick()
        tap("-en")

        rule.runOnIdle {
            assertTrue(requireNotNull(viewModel.state.value?.lesson).answers.isEmpty())
        }
    }

    /** The spoken screen asks to "Tap Record", so mistake practice's bar has the lesson's own Record. */
    @Test
    fun aSpokenMistakeCanBeRecorded() {
        val spoken =
            JsonObject(
                mapOf(
                    "language" to JsonPrimitive("en"),
                    "prompt" to JsonPrimitive("Ask about the rent."),
                    "targetText" to JsonPrimitive("How much is the rent?"),
                ),
            )
        run(replay(FIRST_MISTAKE, "spokenAnswer", spoken))

        rule.onNodeWithText("Tap Record and say it out loud").assertExists()
        rule.onNodeWithText("Record").assertExists()
        rule.onNodeWithText("Check").assertDoesNotExist()
    }
}
