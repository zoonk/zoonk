package com.zoonk.android.feature.activities.music

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's music player test for the notation player, played in the real player. */
@RunWith(AndroidJUnit4::class)
class NotationPlayerFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun shows(text: String) = rule.onNodeWithText(text).performScrollTo().assertIsDisplayed()

    @Test
    fun theMelodyPlaysBarByBarInStaffOrTab() {
        harness.play(listOf(ActivityFixtures.step("notationPlayer"))) {
            grade = { _, _ -> checkResult(true, expected = ActivityFixtures.expected("notationPlayer")) }
        }

        shows("Ode to Joy")
        shows("Beethoven, 1824")
        rule.onNode(hasContentDescription("Bar 1: E, E, F, G.", substring = true)).assertExists()
        shows("4 bars")
        rule.onNodeWithText("Tab").performScrollTo().performClick()
        rule.onNodeWithText("Tab").assertIsSelected()
        // Robolectric's AudioTrack can't run the synth for a whole melody; the emulator plays it.
        rule.onNodeWithContentDescription("Play the melody").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("By steps").performScrollTo().performClick()
        harness.tap("Check")

        shows("Correct!")
    }

    @Test
    fun aRepeatedBarIsReadOnceAndASecondEndingAsItsOwnBar() {
        harness.play(
            listOf(
                activityStep(
                    """
                    {"check":{"kind":"choice","question":"Does it end on C?",
                              "options":[{"id":"o0","isCorrect":true,"reason":"It ends on C.","text":"Yes"}]},
                     "fields":{"notation":"X:1\nM:4/4\nL:1/4\nK:C\n|:C D E F|1 G A B c:|2 c B A G|]","tempo":80,"view":"staff"},
                     "prompt":"Follow the notes.","template":"notationPlayer"}
                    """,
                ),
            ),
        )

        rule.onNode(hasContentDescription("Bar 1: C, D, E, F. Bar 2: G, A, B, C. Bar 3: C, B, A, G.")).assertExists()
    }

    @Test
    fun slowerTemposArePracticeSteps() {
        assertEquals(listOf(50, 65, 80), practiceTempos(80))
        assertEquals(listOf(25, 30, 40), practiceTempos(40))
    }
}
