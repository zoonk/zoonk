package com.zoonk.android.app

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppRoute
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class ShellWindowSizeTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun show() {
        rule.setContent { ShellTestHost() }
    }

    private fun tab(label: String) = rule.onNode(hasText(label) and hasClickAction())

    private fun tabBounds() = listOf("Today", "Plan", "Buddy").map { tab(it).getUnclippedBoundsInRoot() }

    private fun assertBar() {
        val bounds = tabBounds()
        assertEquals(1, bounds.map { it.top }.distinct().size)
        assertTrue(bounds.zipWithNext().all { (a, b) -> a.left < b.left })
        rule.onNodeWithText("Study").assertDoesNotExist()
    }

    private fun assertRail() {
        val bounds = tabBounds()
        assertEquals(1, bounds.map { it.left }.distinct().size)
        assertTrue(bounds.zipWithNext().all { (a, b) -> a.top < b.top })
        rule.onNodeWithText("Study").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aPhoneGetsANavigationBar() = assertBar()

    @Test
    @Config(qualifiers = "w891dp-h411dp-land")
    fun aPhoneOnItsSideKeepsTheBar() = assertBar()

    @Test
    @Config(qualifiers = "w700dp-h1000dp")
    fun aMediumWindowGetsARail() = assertRail()

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun anExpandedWindowGetsADrawerWithTheStudyPlaces() {
        rule.onNodeWithText("Study").assertIsDisplayed()
        listOf("Mistakes notebook", "Exam", "Speaking", "Mind maps", "Statistics").forEach {
            tab(it).assertIsDisplayed()
        }

        tab("Exam").performClick()
        rule.onNode(hasText("Exam") and !hasClickAction()).assertIsDisplayed()
        tab("Exam").assertIsSelected()
        tab("Today").assertIsNotSelected()

        rule.runOnIdle { ShellTest.navigator.open(AppRoute.MockChooser) }
        tab("Exam").assertIsSelected()

        // Onboarding keeps the drawer, as main keeps its sidebar from `lg`.
        rule.runOnIdle { ShellTest.navigator.open(AppRoute.StartGoal()) }
        tab("Today").assertIsSelected()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aTaskCoversTheDrawer() {
        rule.runOnIdle { ShellTest.navigator.open(AppRoute.Lesson("lesson-1")) }

        rule.onNodeWithText("Lesson(lessonId=lesson-1, sessionId=null, firstAnswer=null)").assertIsDisplayed()
        rule.onNodeWithText("Study").assertDoesNotExist()
    }
}
