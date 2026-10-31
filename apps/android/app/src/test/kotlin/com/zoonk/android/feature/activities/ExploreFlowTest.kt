package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.steps.activityRenderers
import com.zoonk.android.feature.player.summaryStep
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's `lesson-explore` browser tests: an explanation draws the activity it explores, with nothing to check. */
@RunWith(AndroidJUnit4::class)
class ExploreFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    @Test
    fun everyActivityAnExplanationCanExploreDrawsWithNothingToCheck() {
        val names = ActivityFixtures.exploreNames.sorted()
        harness.play(names.map { ActivityFixtures.exploreStep(it) } + summaryStep("end"))

        names.forEach { name ->
            assertTrue("$name has no canvas", name.substringBefore('.') in activityRenderers)
            rule.onNodeWithText("Explore $name.").assertIsDisplayed()
            rule.onNodeWithText("Check").assertDoesNotExist()
            harness.tap("Next")
        }
    }

    @Test
    fun anExplanationDrawsTheActivityItExplores() {
        harness.play(listOf(ActivityFixtures.exploreStep("processOrder"), summaryStep("end")))

        rule.onNodeWithText("Chlorophyll absorbs sunlight").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aNumberLineExploredShowsItsWalkSolvedWithNoDotToMove() {
        harness.play(listOf(ActivityFixtures.exploreStep("numberLine"), summaryStep("end")))

        rule.onNode(hasContentDescription("land at 5", substring = true)).assertExists()
        rule.onNode(hasContentDescription("your dot", substring = true)).assertDoesNotExist()
        rule.onNode(hasContentDescription("Your answer on the number line")).assertDoesNotExist()
    }

    @Test
    fun anExplainedChainNamesItsLinksAsTheLessonsNotTheLearners() {
        harness.play(listOf(ActivityFixtures.exploreStep("causeEffectChain"), summaryStep("end")))

        rule.onNode(hasContentDescription("How they connect")).assertExists()
        rule.onNode(hasContentDescription("Your links")).assertDoesNotExist()
    }
}
