package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
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

    /** A call the month's cap cut off: once the day comes, the cap's words go and it's a dropped call that can be called again. */
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

        clock.passOpening()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Call again").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("You've used your call time").assertDoesNotExist()
        compose.onNodeWithText("Call again, or end the call to get feedback on what you said.").assertExists()
        compose.onNodeWithText("Call again").performClick()

        assertEquals(1, retries)
    }
}
