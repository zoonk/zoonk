package com.zoonk.android.feature.activities.music

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isHeading
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.core.content.edit
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's music player tests for the rhythm tapper's sound check, played in the real player. */
@RunWith(AndroidJUnit4::class)
class RhythmTapperFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private val preferences =
        ApplicationProvider.getApplicationContext<Context>().getSharedPreferences(DeviceDelayStore.FILE, Context.MODE_PRIVATE)

    private fun shows(text: String) = rule.onNodeWithText(text).performScrollTo().assertIsDisplayed()

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    @Test
    fun theSoundCheckIsAskedOncePerDevice() {
        harness.play(listOf(ActivityFixtures.step("rhythmTapper")))

        rule.onNode(isHeading() and hasText("Set up your sound")).assertExists()
        tap("Skip for now")

        shows("Start tapping")
        assertEquals("skipped", preferences.getString(DeviceDelayStore.KEY, null))
    }

    @Test
    fun aMeasuredDelayIsKeptAndTheCheckCanBeTakenAgain() {
        preferences.edit(commit = true) { putString(DeviceDelayStore.KEY, "180") }
        harness.play(listOf(ActivityFixtures.step("rhythmTapper")))

        shows("Start tapping")
        rule.onNodeWithText("Set up your sound").assertDoesNotExist()
        tap("Check the sound delay again")

        shows("Set up your sound")
        shows("Start the sound check")
    }

    @Test
    fun theRhythmIsDescribedInWords() {
        preferences.edit(commit = true) { putString(DeviceDelayStore.KEY, "skipped") }
        harness.play(listOf(ActivityFixtures.step("rhythmTapper")))

        shows("90 bpm · 2 rounds")
        rule
            .onNode(
                hasContentDescription(
                    "A rhythm of 16 steps with a beat every 4. Tap on steps 1, 4, 7, 11, 13, over a click on every beat.",
                ),
            ).assertExists()
    }
}
