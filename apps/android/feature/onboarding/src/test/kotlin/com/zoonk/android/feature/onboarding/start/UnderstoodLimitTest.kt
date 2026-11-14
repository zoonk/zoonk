package com.zoonk.android.feature.onboarding.start

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.goalsUnderstanding
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalUnderstandingOneOf
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant

@RunWith(AndroidJUnit4::class)
class UnderstoodLimitTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(compose.mainClock) }

    /** The goals cap took Confirm's place; once its day comes, the gate goes and Confirm is back, with no sentence beside it. */
    @Test
    fun theGoalsCapGivesConfirmBackOnceItsDayComes() {
        var confirms = 0
        val understanding: GoalUnderstandingOneOf = ApiJson.decodeFromString(goalsUnderstanding(title = "Learn Spanish"))
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    val limit = remember { Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening) }
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        UnderstoodScreen(
                            goal = "Learn Spanish",
                            understanding = understanding,
                            activeGoalsLeft = null,
                            timeZone = "UTC",
                            material = emptyList(),
                            hasAccount = true,
                            isCreating = false,
                            error = GoalError.Limit(GoalLimitReason.MonthlyGoals(limit)),
                            goalLimit = null,
                            onConfirm = { confirms++ },
                            edits = FactEdits(null, null, null, {}, { _, _ -> }),
                            onRewrite = {},
                            onCreateAccount = {},
                            onSubscribe = {},
                            onOpenPlan = {},
                        )
                    }
                }
            }
        }

        compose.onNodeWithText("Looks right").assertDoesNotExist()

        clock.passOpening()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Looks right").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("You've started all the new goals you can", substring = true).assertDoesNotExist()
        compose.onNodeWithText("You can try again now.", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Looks right").performClick()

        assertEquals(1, confirms)
    }
}
