package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalUpdateInput
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanContentTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var navigator: AppNavigator
    private val statuses = mutableListOf<GoalUpdateInput.Status>()

    private fun show(
        status: String = "active",
        resumeChangesPlan: Boolean = false,
    ) {
        val summary = learnerSummary(status = status)
        val page = PlanPageState(summary.goals.first(), learnPlan(), summary)
        compose.setContent {
            navigator = rememberAppNavigator()
            ZoonkTheme {
                PlanContent(
                    page = page,
                    standing = Standing.Progress(progress(), done = 13, total = 46),
                    links = PlanLinks(navigator, page),
                    resumeChangesPlan = resumeChangesPlan,
                    isSaving = false,
                    onSetStatus = { statuses += it },
                )
            }
        }
    }

    @Test
    fun archivingAsksFirst() {
        show()

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Archive this goal").performClick()
        assertEquals(emptyList<GoalUpdateInput.Status>(), statuses)
        compose.onNodeWithText("Archive Learn Python?").assertIsDisplayed()
        compose.onNodeWithText("Archive").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.ARCHIVED), statuses)
    }

    @Test
    fun pausingSavesAtOnce() {
        show()

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Pause this goal").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.PAUSED), statuses)
    }

    @Test
    fun resumingSaysWhatItChangesWhenItChangesThePlan() {
        show(status = "paused", resumeChangesPlan = true)

        compose.onNodeWithContentDescription("Plan options").performClick()
        compose.onNodeWithText("Resume this goal").performClick()
        compose
            .onNodeWithText(
                "Your plan picks up from today, starting with the lessons planned for the days you paused.",
            ).assertIsDisplayed()
        compose.onNodeWithText("Resume").performClick()

        assertEquals(listOf(GoalUpdateInput.Status.ACTIVE), statuses)
    }

    @Test
    fun theOpenPhasesChaptersLeadToTheirPages() {
        show()

        compose.onNodeWithText("Sets and tuples").performClick()

        compose.runOnIdle { assertEquals(AppRoute.Chapter(CHAPTER_LATER), navigator.currentRoute) }
    }

    @Test
    fun anotherPhaseOpensOnTap() {
        show()

        compose.onNodeWithText("Python basics").performClick()

        compose.onNodeWithText("Variables and types").assertIsDisplayed()
    }
}
