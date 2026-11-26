package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
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
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MistakePracticeAnswerInput
import com.zoonk.api.models.MistakePracticeFeedback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A lesson's match board replayed from mistakes checks itself once the last pair is made, as in the lesson. */
@RunWith(AndroidJUnit4::class)
class MistakeLessonMatchTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val cache =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )

    private val matchColumns =
        ApiJson.parseToJsonElement(
            """
            {"id":"4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","kind":"matchColumns","position":2,
             "skillId":"5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","wordHints":null,
             "exercise":{"content":{"pairs":[{"left":"hola","right":"hello"},{"left":"gato","right":"cat"}]},"fillBlankOptions":[],
               "id":"00000000-0000-4000-8000-000000000001","kind":"matchColumns","matchColumnsRightItems":["cat","hello"],"position":0,
               "readingPromptWords":[],"sentence":null,"sentenceWordOptions":[],"translationOptions":[],"vocabularyOptions":[],"word":null,
               "wordBankOptions":[]}}
            """.trimIndent(),
        )

    private fun matchPairs(): JsonElement {
        val fixtures = ApiJson.parseToJsonElement(checkNotNull(javaClass.getResource("/activity-fixtures.json")).readText()).jsonObject
        val content = fixtures.getValue("matchPairs").jsonObject.getValue("content")
        return ApiJson.parseToJsonElement(
            """
            {"id":"4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","kind":"activity","position":2,"skillId":"5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
             "citation":null,"image":null,"imagePending":false,"picture":null,"baseMap":null,"minTolerance":null,"roundedAnswer":null,
             "content":$content}
            """.trimIndent(),
        )
    }

    private fun replay(
        step: JsonElement,
        answer: suspend (MistakePracticeAnswerInput) -> MistakePracticeFeedback = { practiceFeedback() },
    ): FakeMistakesApi {
        val entry = fixture("mistake-practice-lesson-entry")
        val lesson = JsonObject(entry.getValue("lesson").jsonObject + ("step" to step))
        val api = FakeMistakesApi(practice(JsonObject(entry + ("lesson" to lesson))), answer = answer)
        val viewModel = practiceViewModel(cache, api)
        viewModel.started()
        rule.setContent {
            ZoonkTheme {
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator()) }
            }
        }
        rule.waitForIdle()
        return api
    }

    private fun tap(text: String) {
        rule.onNode(hasClickAction() and hasText(text)).performScrollTo().performClick()
        rule.waitForIdle()
    }

    @Test
    fun theLastPairOfALanguageMatchChecksItOnce() {
        val api = replay(matchColumns)

        tap("hola")
        tap("hello")
        assertEquals(0, api.rawAnswers.size)
        tap("gato")
        tap("cat")

        assertEquals(1, api.rawAnswers.size)
    }

    @Test
    fun theLastPairOfAMatchPairsActivityChecksItOnce() {
        val api = replay(matchPairs())

        tap("embarazada")
        tap("pregnant")
        tap("éxito")
        tap("success")
        assertEquals(0, api.rawAnswers.size)
        tap("librería")
        tap("bookstore")

        assertEquals(1, api.rawAnswers.size)
    }

    @Test
    fun aBoardThatFailsToSendWaitsForTryAgain() {
        val api = replay(matchColumns, answer = { throw ApiException(ApiError.Network) })

        tap("hola")
        tap("hello")
        tap("gato")
        tap("cat")
        assertEquals(1, api.rawAnswers.size)

        rule.onNodeWithText("Try again").performClick()
        rule.waitForIdle()
        assertEquals(2, api.rawAnswers.size)
    }
}
