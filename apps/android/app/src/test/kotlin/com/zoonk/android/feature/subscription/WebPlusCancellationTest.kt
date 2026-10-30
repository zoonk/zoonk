package com.zoonk.android.feature.subscription

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MeSubscription
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import java.util.UUID
import kotlin.time.Instant

@RunWith(AndroidJUnit4::class)
class WebPlusCancellationTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var page: MutationResult<String> = MutationResult.Done(PAGE)
    private var readAgain = 0

    private fun show(
        provider: String,
        cancelAt: Instant? = null,
    ) {
        val subscription =
            MeSubscription(
                cancelAt = cancelAt,
                cancelAtPeriodEnd = cancelAt != null,
                id = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0d4"),
                periodEnd = null,
                periodStart = null,
                plan = "plus",
                provider = provider,
                status = "active",
            )
        rule.setContent {
            ZoonkTheme {
                Column {
                    CurrentPlan(subscription, rememberAppNavigator(), openWebPlusCancellation = { page }, readPlanAgain = { readAgain++ })
                }
            }
        }
    }

    @Test
    fun aWebPlusOpensStripesCancellationPageAndReadsThePlanAgainOnTheWayBack() {
        show("stripe")

        rule.onNodeWithText("Cancel subscription").performClick()
        rule.waitForIdle()
        assertEquals(PAGE, shadowOf(rule.activity).nextStartedActivity.dataString)
        assertEquals(0, readAgain)

        rule.activityRule.scenario.moveToState(Lifecycle.State.STARTED)
        rule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        rule.waitForIdle()
        assertEquals(1, readAgain)
    }

    @Test
    fun aPageThatWontOpenSaysWhomToContact() {
        page = MutationResult.Failed(ApiError.Unavailable)
        show("stripe")

        rule.onNodeWithText("Cancel subscription").performClick()

        rule.onNodeWithText("Unable to manage your subscription. Contact us at hello@zoonk.com").assertExists()
        assertNull(shadowOf(rule.activity).nextStartedActivity)
    }

    @Test
    fun anEndingWebPlusHasNothingToCancel() {
        show("stripe", cancelAt = Instant.parse("2026-12-01T00:00:00Z"))

        rule.onNodeWithText("Cancel subscription").assertDoesNotExist()
    }

    @Test
    fun aPlayPlusIsManagedInPlay() {
        show("google")

        rule.onNodeWithText("Cancel subscription").assertDoesNotExist()
        rule.onNodeWithText("Manage in Google Play").assertExists()
    }

    private companion object {
        const val PAGE = "https://billing.stripe.com/p/session/cancel"
    }
}
