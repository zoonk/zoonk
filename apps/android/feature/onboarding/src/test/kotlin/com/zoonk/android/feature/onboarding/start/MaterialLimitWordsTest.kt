package com.zoonk.android.feature.onboarding.start

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.UsageLimit
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The goal's upload and a question about its material are caps over the last 30 days: their words follow the day more comes back. */
@RunWith(AndroidJUnit4::class)
class MaterialLimitWordsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(compose.mainClock) }

    private fun refused(
        resource: String,
        availableAt: String,
    ) = WriteOutcome.Refused(Refusal.Limit(UsageLimit("rolling30Days", resource, "free", availableAt).received()))

    @Test
    fun theUploadsWordsLeaveTheTitleOnceTheDayComes() {
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme { Text(attachErrorMessage(refused("upload", clock.opening.toString()))) }
            }
        }
        compose.onNodeWithText("You've used your uploads. More later today, or subscribe to keep going.").assertExists()

        clock.passOpening()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("You can try again now.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("You've used your uploads", substring = true).assertDoesNotExist()
    }

    @Test
    fun theQuestionsWordsLeaveTheTitleOnceTheDayComes() {
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme { MaterialAnswer(refused("materialQuestion", clock.opening.toString())) }
            }
        }
        compose.onNodeWithText("You've used your questions. More later today, or subscribe to keep going.").assertExists()

        clock.passOpening()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("You can try again now.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("You've used your questions", substring = true).assertDoesNotExist()
    }

    /** The device's clock is ahead of the server's: a day already past when the refusal arrived is never offered. */
    @Test
    fun aDayPastOnArrivalKeepsTheRefusal() {
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme { MaterialAnswer(refused("materialQuestion", "2020-01-01T00:00:00Z")) }
            }
        }
        compose.onNodeWithText("You've used your questions").assertExists()
        compose.onNodeWithText("You can try again now.", substring = true).assertDoesNotExist()
    }
}
