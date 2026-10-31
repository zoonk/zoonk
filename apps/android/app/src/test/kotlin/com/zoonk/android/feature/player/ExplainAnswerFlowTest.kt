package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.navigation.AppRoute
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ExplainAnswerFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun missTypedAnswer(configure: FakeLessonPlayerApi.() -> Unit = {}) {
        harness.play(listOf(typedAnswerStep("why"), summaryStep("end"))) {
            grade = { _, _ -> checkResult(isCorrect = false) }
            configure()
        }
        rule.onNode(hasSetTextAction()).performTextInput("Rain")
        harness.tap("Check")
        rule.onNodeWithText("Not quite").assertIsDisplayed()
    }

    private fun tapExplain() {
        rule.onNodeWithText("Explain my answer").performScrollTo()
        harness.tap("Explain my answer")
    }

    @Test
    fun aWrongTypedAnswerIsExplainedOnTap() {
        missTypedAnswer()

        tapExplain()

        rule.onNodeWithText("Why that answer misses").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("It names the droplets, not why they float.").performScrollTo().assertIsDisplayed()
        assertEquals(listOf("why" to "Rain"), harness.api.explained)
    }

    @Test
    fun aFailedExplanationCanBeAskedAgain() {
        missTypedAnswer { explain = { throw ApiException(ApiError.Network) } }

        tapExplain()
        rule.onNodeWithText("We couldn't explain it right now. Try again in a moment.").performScrollTo().assertIsDisplayed()

        harness.api.explain = { "It names the droplets, not why they float." }
        tapExplain()

        rule.onNodeWithText("It names the droplets, not why they float.").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aGuestOutOfHelpIsAskedToCreateAnAccount() {
        val limit = Json.parseToJsonElement("""{"limit":{"tier":"guest","period":"day"}}""")
        missTypedAnswer {
            explain =
                { throw ApiException(ApiError.Unavailable, code = "USAGE_LIMIT_REACHED", status = 403, details = limit) }
        }

        tapExplain()

        rule.onNodeWithText("You've used today's free help. Create a free account to keep going.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Create a free account").performScrollTo().performClick()
        assertEquals(listOf(AppRoute.Login), harness.opened)
    }
}
