package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant

@RunWith(AndroidJUnit4::class)
class DroppedCallScreenTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(compose.mainClock) }

    private fun showDropped(
        dropped: DroppedCall,
        limit: Limit.Reached? = null,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    DroppedCallScreen(dropped, limit, "Lucía", "Lucía", DroppedCallActions({}, {}, {}, {}, {}, {}))
                }
            }
        }
    }

    /** A call its call time ended didn't drop: the screen's title says what ran out, once. */
    @Test
    fun aCallItsCallTimeEndedIsTitledByWhatRanOutNotAsDropped() {
        showDropped(DroppedCall(DroppedReason.Limit, retry = null), Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days))

        compose.onNodeWithText("The call dropped").assertDoesNotExist()
        compose.onAllNodesWithText("You've used your call time").assertCountEquals(1)
    }

    /** Calls paused for everyone: the title says so, and nothing offers to call again now. */
    @Test
    fun aCallThatPausedSaysSoAndOffersNoCallAgain() {
        showDropped(droppedCall(continuing = true, LiveCallPhase.Failed, LiveCallFailure.CallsPaused, micBlocked = false)!!)

        compose.onNodeWithText("The call dropped").assertDoesNotExist()
        compose.onAllNodesWithText("Calls are paused").assertCountEquals(1)
        compose.onNodeWithText("Call again").assertDoesNotExist()
    }

    /** A call the month's cap cut off: once the day comes, its title says the time is back over "You can try again now.", and Call again. */
    @Test
    fun aCallTheCapCutOffCanBeCalledAgainOnceItsDayComes() {
        var retries = 0
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    val limit = remember { Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening) }
                    DroppedCallScreen(
                        DroppedCall(DroppedReason.Limit, retry = null),
                        limit,
                        characterName = "Lucía",
                        title = "Lucía",
                        actions = DroppedCallActions({}, onRetry = { retries++ }, {}, {}, {}, {}),
                    )
                }
            }
        }

        compose.onNodeWithText("You've used your call time").assertExists()
        compose.onNodeWithText("Call again").assertDoesNotExist()
        val title = compose.onNodeWithText("You've used your call time").getBoundsInRoot().top

        clock.passOpening()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Call again").fetchSemanticsNodes().isNotEmpty() }
        assertEquals(title, compose.onNodeWithText("Your call time is back").getBoundsInRoot().top)
        compose.onNodeWithText("You've used your call time").assertDoesNotExist()
        compose.onNodeWithText("The call dropped").assertDoesNotExist()
        compose.onNodeWithText("You can try again now.").assertExists()
        compose.onNodeWithText("Call again").performClick()

        assertEquals(1, retries)
    }
}
