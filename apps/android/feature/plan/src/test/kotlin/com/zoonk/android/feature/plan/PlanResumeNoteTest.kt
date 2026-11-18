package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class PlanResumeNoteTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** Under the tab's search header in a short window, why Resume didn't save is read in the page, never behind the header. */
    @Config(qualifiers = "w480dp-h256dp-land", fontScale = 2f)
    @Test
    fun aResumeRefusalInAShortWindowStartsBelowTheHeaderOverThePage() {
        val summary = learnerSummary()
        val page =
            PlanPageState(summary.goals.first(), learnPlan(), summary).let {
                it.copy(goal = it.goal.copy(status = LearnerSummaryGoal.Status.PAUSED))
            }
        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme {
                Surface {
                    Column {
                        Box(Modifier.fillMaxWidth().height(128.dp).testTag(HEADER))
                        PlanContent(
                            page = page,
                            standing = Standing.Progress(progress(), done = 13, known = 0, total = 46),
                            structure = null,
                            links = PlanLinks(navigator, page),
                            resume = Resume.Plain,
                            isSaving = false,
                            onSetStatus = {},
                            resumeFailure = ResumeFailure.GoalLimit,
                            onAdjust = {},
                        )
                    }
                }
            }
        }
        compose.waitForIdle()

        val header = compose.onNodeWithTag(HEADER).getUnclippedBoundsInRoot()
        val note = compose.onNodeWithText("Pause another goal", substring = true).assertIsDisplayed().getUnclippedBoundsInRoot()
        assertTrue("the refusal ($note) starts below the header ($header)", note.top >= header.bottom)
    }

    private companion object {
        const val HEADER = "header"
    }
}
