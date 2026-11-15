package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanBase
import com.zoonk.api.models.PlanChangeResult
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

    /** On a narrow phone, where a label and its mark no longer fit one line. */
    @Test
    @Config(qualifiers = "w300dp-h1600dp")
    fun theRecommendationComesAsAMarkThatMovesNoChoice() {
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val page = PlanPageState(summary.goals.first(), plan(BASES), summary)
        var advice by mutableStateOf(BasesAdviceAsk(planAdviceRevision(page.plan), BasesAdviceAsk.Status.Pending))
        compose.setContent {
            ZoonkTheme {
                Column { BasesChoices(page, page.plan.bases!!, PlanEdits(basesAdvice = advice), BasesDraft(), onDraft = {}, onDone = {}) }
            }
        }
        val choices = listOf("Every lesson", "First lessons only", "One short lesson each", "Skip")
        val waiting = choices.map { compose.onNodeWithText(it).getUnclippedBoundsInRoot() }
        compose.onNodeWithText("Recommended").assertDoesNotExist()

        advice = advice.copy(status = BasesAdviceAsk.Status.Answered, recommended = PlanBase.Choice.QUICK)
        compose.waitForIdle()

        assertEquals(waiting, choices.map { compose.onNodeWithText(it).getUnclippedBoundsInRoot() })
        compose.onNode(hasText("One short lesson each") and hasText("Recommended")).assertIsDisplayed()
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
