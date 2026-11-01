package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
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
}
