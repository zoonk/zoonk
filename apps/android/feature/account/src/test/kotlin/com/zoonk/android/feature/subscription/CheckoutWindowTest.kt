package com.zoonk.android.feature.subscription

import android.app.Activity
import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.account
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MeResponse
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Subscribe opens Play's sheet once, on the window then shown, though it changes width both ways while the checkout
 * reads; a checkout whose reads land after the learner left opens no sheet.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CheckoutWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var scenario: ActivityScenario<CheckoutTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun playsFailureThatArrivesWhileTheWindowWidensAndNarrowsSaysSo() {
        val (planRead, billing) = launchACheckout()
        rule.onNodeWithText("Subscribe").performClick()
        planRead.complete(account(ANA))
        rule.waitForIdle()

        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        billing.fail()
        rule.waitForIdle()

        assertEquals(PurchaseState.PlayFailed, CheckoutTest.store.purchase.value)
    }

    @Test
    fun playsFailureThatArrivesAfterTheLearnerLeftShowsNothingOnReturn() {
        val (planRead, billing) = launchACheckout()
        rule.onNodeWithText("Subscribe").performClick()
        planRead.complete(account(ANA))
        rule.waitForIdle()
        assertEquals(1, billing.bought.size)
        CheckoutTest.visible = false
        rule.waitForIdle()
        billing.fail()
        rule.waitForIdle()
        CheckoutTest.visible = true
        rule.waitForIdle()
        assertEquals(PurchaseState.Idle, CheckoutTest.store.purchase.value)
    }

    @Test
    fun aCheckoutReadingWhileTheWindowWidensAndNarrowsOpensPlaysSheetOnceOnTheCurrentWindow() {
        val (planRead, billing) = launchACheckout()

        rule.onNodeWithText("Subscribe").performClick()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        planRead.complete(account(ANA))
        rule.waitForIdle()

        assertEquals(listOf(BillingPeriod.Yearly to ANA), billing.bought)
        scenario.onActivity { current -> assertEquals(current, billing.hosts.single()) }
        assertFalse(billing.hosts.single().isDestroyed)
    }

    @Test
    fun aCheckoutWhoseReadsLandAfterTheLearnerLeftOpensNoSheetOnTheirReturn() {
        val (planRead, billing) = launchACheckout()

        rule.onNodeWithText("Subscribe").performClick()
        CheckoutTest.visible = false
        rule.waitForIdle()
        planRead.complete(account(ANA))
        rule.waitForIdle()
        CheckoutTest.visible = true
        rule.waitForIdle()

        assertEquals(emptyList<Pair<BillingPeriod, String>>(), billing.bought)
        assertEquals(PurchaseState.Idle, CheckoutTest.store.purchase.value)
    }

    @Test
    fun aCheckoutWhosePlanReadFailsWhileTheWindowWidensAndNarrowsSaysSo() {
        val (planRead, billing) = launchACheckout()

        rule.onNodeWithText("Subscribe").performClick()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        planRead.completeExceptionally(ApiException(ApiError.Network))
        rule.waitForIdle()

        assertEquals(emptyList<Pair<BillingPeriod, String>>(), billing.bought)
        assertEquals(PurchaseState.PlanCheckFailed, CheckoutTest.store.purchase.value)
    }

    @Test
    fun aCheckoutsFailureShownBeforeTheLearnerLeftIsGoneOnTheirReturn() {
        val (planRead, _) = launchACheckout()

        rule.onNodeWithText("Subscribe").performClick()
        planRead.completeExceptionally(ApiException(ApiError.Network))
        rule.waitForIdle()
        assertEquals(PurchaseState.PlanCheckFailed, CheckoutTest.store.purchase.value)
        CheckoutTest.visible = false
        rule.waitForIdle()
        CheckoutTest.visible = true
        rule.waitForIdle()

        assertEquals(PurchaseState.Idle, CheckoutTest.store.purchase.value)
    }

    /** The plan offer, signed in, with the checkout's plan read held until the returned read completes. */
    private fun launchACheckout(): Pair<CompletableDeferred<MeResponse>, HostRecordingBilling> {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = CheckoutTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val session = AuthenticatedSession(ANA, "token-a", "local-a")
        val main = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += session.bearerToken to session.accountId },
                MemoryCredentials(StoredSession(session, false)),
                DraftStore(folder.newFolder(), main),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        runBlocking { sessions.restore() }
        val planRead = CompletableDeferred<MeResponse>()
        val api = FakeSubscriptionApi().apply { accountRead = { planRead.await() } }
        val billing = HostRecordingBilling()
        CheckoutTest.visible = true
        CheckoutTest.store = SubscriptionStore(api, billing, sessions, AppCache(sessions, main), main, MutableStateFlow(false))
        scenario = ActivityScenario.launch(CheckoutTestActivity::class.java)
        return planRead to billing
    }

    /** Play's sheet, recording the window each purchase opened on. */
    private class HostRecordingBilling(
        private val play: FakePlayBilling = FakePlayBilling(),
    ) : PlayBilling by play {
        fun fail() {
            play.updates.tryEmit(PlayPurchaseUpdate.Failed)
        }

        val bought get() = play.bought
        val hosts = mutableListOf<Activity>()

        override suspend fun buy(
            activity: Activity,
            offers: PlusOffers,
            offer: PlusOffer,
            accountId: String,
        ): Boolean {
            hosts += activity
            return play.buy(activity, offers, offer, accountId)
        }
    }
}

/** What outlives [CheckoutTestActivity]'s recreations, as the app's container does. */
object CheckoutTest {
    /** False while the learner is away from the offer, its view models kept, as another tab keeps them. */
    var visible by mutableStateOf(true)
    lateinit var store: SubscriptionStore
}

class CheckoutTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                if (CheckoutTest.visible) {
                    val checkout = rememberCheckout(CheckoutTest.store)
                    Button(onClick = { checkout?.invoke(BillingPeriod.Yearly) }) { Text("Subscribe") }
                }
            }
        }
    }
}
