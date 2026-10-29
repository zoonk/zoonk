package com.zoonk.android.app

import androidx.activity.BackEventCompat
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToIndex
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppRoute
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class ShellNavigationTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<ShellTestActivity>

    @Before
    fun launch() {
        ShellTest.reset()
        ShellTest.registerActivity()
        scenario = ActivityScenario.launch(ShellTestActivity::class.java)
    }

    @After
    fun close() = scenario.close()

    private fun tab(label: String) = rule.onNode(hasText(label) and hasClickAction())

    private fun open(route: AppRoute) = rule.runOnIdle { ShellTest.navigator.open(route) }

    private fun pressBack() = scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }

    @Test
    fun tabSwitchesKeepEachTabsStackScrollAndViewModel() {
        rule.onNodeWithTag("list:today").performScrollToIndex(50)
        tab("Plan").performClick()
        open(AppRoute.Chapter("chapter-1"))
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()

        tab("Today").performClick()
        rule.onNodeWithTag("row:today:50").assertIsDisplayed()
        rule.onNodeWithTag("row:today:0").assertDoesNotExist()

        tab("Plan").performClick()
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()
        tab("Plan").assertIsSelected()

        assertEquals(mapOf("today" to 1, "plan" to 1, "chapter:chapter-1" to 1), ShellTest.viewModelsCreated)
        assertEquals(emptyList<String>(), ShellTest.viewModelsCleared)
    }

    @Test
    fun reselectingTheTabGoesBackToItsRoot() {
        tab("Plan").performClick()
        open(AppRoute.Subject("biology"))
        open(AppRoute.Chapter("chapter-1"))
        tab("Plan").performClick()

        rule.onNodeWithTag("row:plan:0").assertIsDisplayed()
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertDoesNotExist()
    }

    @Test
    fun backFollowsTheStackThenGoesHomeThenLeaves() {
        tab("Plan").performClick()
        open(AppRoute.Chapter("chapter-1"))
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()

        pressBack()
        rule.onNodeWithTag("row:plan:0").assertIsDisplayed()

        pressBack()
        rule.onNodeWithTag("row:today:0").assertIsDisplayed()
        tab("Today").assertIsSelected()
        assertEquals(listOf("chapter:chapter-1"), ShellTest.viewModelsCleared)

        pressBack()
        scenario.onActivity { assertTrue(it.isFinishing) }
    }

    @Test
    fun aPagesBackButtonGoesBack() {
        open(AppRoute.Mistakes)
        rule.onNodeWithContentDescription("Back").performClick()

        rule.onNodeWithTag("row:today:0").assertIsDisplayed()
    }

    @Test
    fun predictiveBackShowsWhereBackLeadsAndCancelsCleanly() {
        open(AppRoute.Chapter("chapter-1"))

        scenario.onActivity {
            it.onBackPressedDispatcher.dispatchOnBackStarted(BackEventCompat(0f, 400f, 0f, BackEventCompat.EDGE_LEFT))
            it.onBackPressedDispatcher.dispatchOnBackProgressed(BackEventCompat(200f, 400f, 0.5f, BackEventCompat.EDGE_LEFT))
            it.onBackPressedDispatcher.dispatchOnBackCancelled()
        }
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()

        scenario.onActivity {
            it.onBackPressedDispatcher.dispatchOnBackStarted(BackEventCompat(0f, 400f, 0f, BackEventCompat.EDGE_LEFT))
            it.onBackPressedDispatcher.dispatchOnBackProgressed(BackEventCompat(300f, 400f, 0.8f, BackEventCompat.EDGE_LEFT))
            it.onBackPressedDispatcher.onBackPressed()
        }
        rule.onNodeWithTag("row:today:0").assertIsDisplayed()
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertDoesNotExist()
    }

    @Test
    fun tasksCoverTheFrameAndCloseBackToIt() {
        open(AppRoute.Mistakes)
        open(AppRoute.MistakePractice())

        rule.onNodeWithText("MistakePractice(skillId=null)").assertIsDisplayed()
        tab("Today").assertDoesNotExist()

        rule.onNodeWithContentDescription("Leave").performClick()
        rule.onNodeWithText("Mistakes").assertIsDisplayed()
        tab("Today").assertIsDisplayed()
    }

    @Test
    fun aTaskOverTodayTakesTodayOutOfComposition() {
        open(AppRoute.MistakePractice())

        rule.onNodeWithTag("list:today").assertDoesNotExist()

        rule.onNodeWithContentDescription("Leave").performClick()
        rule.onNodeWithTag("list:today").assertIsDisplayed()
    }

    @Test
    fun onboardingHidesTheBarOnAPhone() {
        open(AppRoute.StartGoal())

        rule.onNodeWithText("StartGoal(goal=null, planId=null, draftId=null)").assertIsDisplayed()
        tab("Today").assertDoesNotExist()

        pressBack()
        tab("Today").assertIsDisplayed()
    }

    @Test
    fun sectionsCloseToWhereTheyOpened() {
        tab("Plan").performClick()
        open(AppRoute.Chapter("chapter-1"))
        open(AppRoute.Settings)
        open(AppRoute.Profile)
        rule.runOnIdle { ShellTest.navigator.closeSection() }

        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()
    }

    @Test
    fun recreationKeepsTabsStacksScrollAndViewModels() {
        rule.onNodeWithTag("list:today").performScrollToIndex(40)
        tab("Plan").performClick()
        rule.onNodeWithTag("list:plan").performScrollToIndex(30)
        open(AppRoute.Chapter("chapter-1"))
        rule.waitForIdle()

        scenario.recreate()

        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()
        pressBack()
        rule.onNodeWithTag("row:plan:30").assertIsDisplayed()
        tab("Today").performClick()
        rule.onNodeWithTag("row:today:40").assertIsDisplayed()

        // Recreation kept every ViewModel; only the page back left was cleared.
        assertEquals(mapOf("today" to 1, "plan" to 1, "chapter:chapter-1" to 1), ShellTest.viewModelsCreated)
        assertEquals(listOf("chapter:chapter-1"), ShellTest.viewModelsCleared)
    }

    @Test
    fun theSamePageOnTwoTabsKeepsTwoViewModels() {
        open(AppRoute.Chapter("chapter-1"))
        tab("Plan").performClick()
        open(AppRoute.Chapter("chapter-1"))
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()
        tab("Today").performClick()
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()

        assertEquals(2, ShellTest.viewModelsCreated["chapter:chapter-1"])

        pressBack()
        rule.waitForIdle()
        assertEquals(listOf("chapter:chapter-1"), ShellTest.viewModelsCleared)
        tab("Plan").performClick()
        rule.onNodeWithText("Chapter(chapterId=chapter-1)").assertIsDisplayed()
        assertEquals(2, ShellTest.viewModelsCreated["chapter:chapter-1"])
    }
}
