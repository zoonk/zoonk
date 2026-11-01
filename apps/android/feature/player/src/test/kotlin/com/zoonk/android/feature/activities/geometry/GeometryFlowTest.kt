package com.zoonk.android.feature.activities.geometry

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GeometryFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun play(
        fixture: String,
        isCorrect: Boolean,
        restoration: StateRestorationTester,
    ) = harness.play(listOf(ActivityFixtures.step(fixture)), restoration = restoration) {
        grade = { _, _ -> checkResult(isCorrect, expected = ActivityFixtures.expected(fixture)) }
    }

    private fun add(element: String) = rule.onNodeWithContentDescription(element).performScrollTo().performClick()

    private fun buildCarbonDioxide(doubleBonds: Boolean) {
        add("Add Carbon")
        add("Add Oxygen bonded to Carbon 1")
        add("Add Oxygen bonded to Carbon 1")
        if (doubleBonds) {
            rule.onNodeWithContentDescription("Oxygen 1: 1 of 2 bonds").performClick()
            rule.onNodeWithContentDescription("Oxygen 2: 1 of 2 bonds").performClick()
        }
    }

    @Test
    fun moleculeBuilderKeepsItsUndoWhenAndroidRecreatesTheScreen() {
        val restoration = StateRestorationTester(rule)
        play("moleculeBuilder", isCorrect = true, restoration = restoration)

        buildCarbonDioxide(doubleBonds = false)
        restoration.emulateSavedInstanceStateRestore()
        rule.onNodeWithContentDescription("Undo").performScrollTo().performClick()

        rule.onNodeWithContentDescription("Oxygen 2:", substring = true).assertDoesNotExist()
        rule.onNodeWithContentDescription("Oxygen 1: 1 of 2 bonds").assertExists()
    }
}
