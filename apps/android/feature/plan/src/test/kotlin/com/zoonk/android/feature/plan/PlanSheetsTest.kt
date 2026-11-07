package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChangeResult
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h1600dp")
class PlanSheetsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var answer: (PlanChangeResult?) -> Unit = {}
    private var done = 0
    private val sheetAnswers = mutableStateMapOf<UUID, PlanChangeResult?>()
    private var open by mutableStateOf(true)

    private fun focus() {
        val plan = coveragePlan(areas = "[${area("Algebra", focused = true)},${area("Geometry")}]")
        val page = learnerSummary().let { PlanPageState(it.goals.first(), plan, it) }
        val edits =
            PlanEdits(
                change = { _, _, answered -> answer = answered },
                sheetAnswers = sheetAnswers,
                answerSheet = { opening, result -> sheetAnswers[opening] = result },
            )
        compose.setContent {
            ZoonkTheme { Column { if (open) ChooseFocusBody(page, edits, onFocusTest = {}, onDone = { done++ }) } }
        }
    }

    @Test
    fun aFocusSavedFromAnEarlierOpeningLeavesTheNextOneOpen() {
        focus()
        compose.onNodeWithText("Geometry").performClick()
        compose.onNodeWithText("Focus on these").performClick()
        open = false
        compose.waitForIdle()
        open = true
        compose.waitForIdle()

        answer(PlanChangeResult(change = null, status = PlanChangeResult.Status.APPLIED))

        compose.onNodeWithText("Focus on these").assertIsDisplayed()
        assertEquals(0, done)
    }

    @Test
    fun tryAgainKeepsItsPlaceAndTheFailureWhileTheRecommendationIsAskedAgain() {
        val retried = CompletableDeferred<PlanBasesAdvice?>()
        var asks = 0
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val page = PlanPageState(summary.goals.first(), plan(BASES), summary)
        val edits = PlanEdits(adviseOnBases = { if (asks++ == 0) null else retried.await() })
        compose.setContent {
            ZoonkTheme { Column { BasesChoices(page, page.plan.bases!!, edits, BasesDraft(), onDraft = {}, onDone = {}) } }
        }
        compose.onNodeWithText("Get a recommendation").performClick()
        val failed = compose.onNodeWithText("Try again").getUnclippedBoundsInRoot()

        compose.onNodeWithText("Try again").performClick()
        compose.waitForIdle()

        assertEquals(failed, compose.onNodeWithText("Try again").getUnclippedBoundsInRoot())
        compose.onNodeWithText("We couldn't get a recommendation.").assertIsDisplayed()
        compose
            .onNode(
                hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate) and hasAnySibling(hasText("Try again")),
                useUnmergedTree = true,
            ).assertExists()
        retried.complete(null)
    }

    private companion object {
        val BASES =
            """
            "bases":{"daysLeft":12,"knownCount":0,"items":[
             {"area":"Matemática","choice":"essential","choices":["deep","essential","quick","skip"],
              "minutes":{"deep":120,"essential":40,"quick":10},"name":"Frações","neededFor":["Probabilidade"],
              "skillId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b01","studied":false}]}
            """.trimIndent()
    }
}
