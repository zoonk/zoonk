package com.zoonk.android.feature.activities.math

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ActivityRoundedAnswer
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DistributionSharesTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theTailsReadAtTheShareBetweenTheHandlesPrecision() {
        compose.setContent {
            ZoonkTheme {
                distributionExplorerRenderer.canvas(
                    ActivityProps(
                        content = ActivityFixtures.content("distributionExplorer"),
                        answer = null,
                        expected = null,
                        isCorrect = null,
                        phase = ActivityPhase.Answering,
                        isLocked = false,
                        onAnswerChange = {},
                        roundedAnswer = ActivityRoundedAnswer(places = 0, value = 95.0),
                    ),
                )
            }
        }

        // 90 to 110 on a normal of mean 100 and SD 15 holds 49.5%, with 25.25% on each side: 25% + 50% + 25%.
        compose.onNodeWithText("< 90: 25%").assertExists()
        compose.onNodeWithText("> 110: 25%").assertExists()
    }
}
