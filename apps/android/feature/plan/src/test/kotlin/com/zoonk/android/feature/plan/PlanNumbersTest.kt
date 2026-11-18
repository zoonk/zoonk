package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h1600dp")
class PlanNumbersTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aPausedGoalKeepsTheScheduleItResumesTo() {
        val summary = learnerSummary()
        val goal = summary.goals.first().copy(status = LearnerSummaryGoal.Status.PAUSED)
        val page = PlanPageState(goal, learnPlan(), summary)

        compose.setContent {
            ZoonkTheme {
                PlanNumbers(page, standing = null, variant = NumberVariant.Tiles, links = PlanLinks(rememberAppNavigator(), page))
            }
        }

        compose.onNodeWithText("Schedule").assertIsDisplayed()
    }
}
