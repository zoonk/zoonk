package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.livecall.LiveCallFailure
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
class CallProblemTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(compose.mainClock) }

    /**
     * A call refused for the month's cap: once the day comes on the open screen, nothing ran out, so no title
     * says it did, and the bar offers Try again, which starts the call again.
     */
    @Test
    fun aRefusedCallOffersTryAgainOnceItsDayComes() {
        var retries = 0
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    val limit = remember { Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening) }
                    CallProblem(
                        CallProblemKind.Failed(LiveCallFailure.Limit, limit),
                        title = "Lucía",
                        actions = CallProblemActions({}, onRetry = { retries++ }, {}, {}, {}),
                    )
                }
            }
        }

        compose.onNodeWithText("You've used your call time").assertExists()
        compose.onNodeWithText("Subscribe").assertExists()

        clock.passOpening()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Try again").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("You can try again now.").assertExists()
        compose.onNodeWithText("You've used your call time").assertDoesNotExist()
        compose.onNodeWithText("Subscribe").assertDoesNotExist()
        compose.onNodeWithText("Try again").performClick()

        assertEquals(1, retries)
    }
}
