package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanChangeResult
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanEditorTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var asked by mutableStateOf(emptyMap<PlanPart, List<PlanOp>>())
    private var sheetAnswers by mutableStateOf(emptyMap<UUID, PlanChangeResult?>())
    private val toolAnswered = mutableListOf<(PlanChangeResult?) -> Unit>()

    private fun show(extra: String) {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), plan(extra), summary)
        compose.setContent {
            val edits =
                PlanEdits(
                    asked = asked,
                    chooseTools = { answer, answered ->
                        toolAnswered += answered
                        asked = asked + (PlanPart.Tools to listOf(answer.operation))
                    },
                    sheetAnswers = sheetAnswers,
                    answerSheet = { opening, result -> sheetAnswers = sheetAnswers + (opening to result) },
                )
            ZoonkTheme { Column { PlanEditorBody(page, edits) } }
        }
    }

    @Test
    fun anEarlierToolSaveLeavesTheNextToolsSheetOpen() {
        show(TOOLS)
        compose.onNodeWithContentDescription("Choose how you'll use Python").performScrollTo().performClick()
        compose.onNodeWithText("I have it").performClick()
        compose.onNodeWithText("Save").performClick()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithText("More later: Spreadsheet").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Choose how you'll use Spreadsheet (Google Sheets or Excel)").performScrollTo().performClick()

        compose.runOnIdle { toolAnswered.single()(PlanChangeResult(change = planChange(), status = PlanChangeResult.Status.APPLIED)) }

        compose.onNodeWithText("How will you use it?").assertIsDisplayed()
    }

    private companion object {
        const val TOOLS =
            """"tools":[{"choice":null,"essential":true,"later":false,"name":"Python","system":null},""" +
                """{"choice":null,"essential":false,"later":true,"name":"Spreadsheet (Google Sheets or Excel)","system":null}]"""
    }
}
