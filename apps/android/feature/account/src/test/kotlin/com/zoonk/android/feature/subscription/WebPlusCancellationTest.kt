package com.zoonk.android.feature.subscription

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellation.State
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID
import kotlin.time.Instant

@RunWith(AndroidJUnit4::class)
class WebPlusCancellationTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var response: suspend () -> StripeSubscriptionCancellation? = { web(State.RENEWING) }
    private var answer: MutationResult<StripeSubscriptionCancellationReceipt> =
        MutationResult.Done(
            StripeSubscriptionCancellationReceipt(ENDS),
        )
    private var cancellationArrives: CompletableDeferred<Unit>? = null
    private var darkTheme = false
    private var higherContrast = false
    private var sent = 0
    private var keepAnswer: MutationResult<Unit> = MutationResult.Done(Unit)
    private var keeps = 0
    private var reads = 0
    private var profile by mutableStateOf(false)
    private var subscription by mutableStateOf<MeSubscription?>(plan())
    private val website =
        AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), scope).resource(Audience.SignedIn) {
            reads++
            response()
        }

    @After
    fun close() = scope.cancel()

    private fun show() {
        rule.setContent {
            ZoonkTheme(darkTheme = darkTheme, moreContrast = higherContrast) {
                Surface {
                    val cancellation =
                        viewModel {
                            WebPlusCancellationViewModel(
                                send = {
                                    sent++
                                    cancellationArrives?.await()
                                    answer
                                },
                                keepPlus = {
                                    keeps++
                                    keepAnswer
                                },
                            )
                        }
                    WebPlusCancellationDialog(cancellation)
                    if (profile) {
                        webPlusDeletionNotice(website)?.let { Text(it) }
                    } else {
                        val state by website.collectShown()
                        Column(Modifier.verticalScroll(rememberScrollState())) {
                            AccountPlans(
                                subscription,
                                state,
                                rememberAppNavigator(),
                                cancellation,
                                onRetryWebsite = { scope.launch { website.refresh() } },
                                offer = { Text("Free offer") },
                            )
                        }
                    }
                }
            }
        }
    }

    private fun inDialog(text: String) = rule.onNode(hasText(text) and hasAnyAncestor(isDialog()))

    private fun update(state: State) {
        response = { web(state) }
        rule.runOnIdle { scope.launch { website.refresh() } }
    }

    @Test
    fun aRenewingPlanCanBeCanceledAndItsScheduledEndUndone() {
        show()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("You keep Plus until the end of the period you already paid for.").assertExists()
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(1, sent)
        update(State.ENDING)
        rule.onNodeWithText("Your subscription will end on Dec 1, 2026.").assertExists()
        rule.onNodeWithText("Keep Plus").performScrollTo().performClick()
        rule.waitForIdle()
        assertEquals(1, keeps)
        update(State.RENEWING)
        rule.onNodeWithText("Renews on Dec 1, 2026.").assertExists()
        rule.onNodeWithText("Cancel Plus").assertExists()
    }

    @Test
    fun anUnpaidWebsitePlanIsShownWithoutAnActivePlanAndCanStopRetries() {
        subscription = null
        response = { web(State.UNPAID) }
        show()
        rule.onNodeWithText("Your last renewal payment failed.").assertExists()
        rule.onNodeWithText("Free offer").assertDoesNotExist()
        rule.onNodeWithText("Active").assertDoesNotExist()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("Plus ends right away, and we stop retrying your renewal payment.").assertExists()
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(1, sent)
        response = { null }
        rule.runOnIdle { scope.launch { website.refresh() } }
        rule.onNodeWithText("Free offer").assertExists()
        rule.onNodeWithText("Your last renewal payment failed.").assertDoesNotExist()
    }

    @Test
    fun theWebsiteStateAndDateWinOverStaleAccountFields() {
        subscription = plan().copy(cancelAt = Instant.parse("2026-11-15T12:00:00Z"), cancelAtPeriodEnd = false)
        response = { web(State.ENDING) }
        show()
        rule.onNodeWithText("Subscription ending").assertExists()
        rule.onNodeWithText("Your subscription will end on Dec 1, 2026.").assertExists()
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
        rule.onNodeWithText("Keep Plus").assertExists()
    }

    @Test
    fun aGooglePlanAndAnUnpaidWebsitePlanKeepTheirOwnControls() {
        subscription = plan("google")
        response = { web(State.UNPAID) }
        show()
        rule.onNodeWithText("Manage in Google Play").assertExists()
        rule.onNodeWithText("Website subscription").assertExists()
        rule.onNodeWithText("Your last renewal payment failed.").assertExists()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("Plus ends right away, and we stop retrying your renewal payment.").assertExists()
    }

    @Test
    fun anApplePlanAndAnEndingWebsitePlanKeepTheirOwnControls() {
        subscription = plan("apple")
        response = { web(State.ENDING) }
        show()
        rule.onNodeWithText("This subscription is managed through the App Store.", substring = true).assertExists()
        rule.onNodeWithText("Website subscription").assertExists()
        rule.onNodeWithText("Keep Plus").performScrollTo().performClick()
        rule.waitForIdle()
        assertEquals(1, keeps)
    }

    @Test
    fun aStorePlanWithoutWebsiteBillingHasOnlyItsStoreControls() {
        subscription = plan("google")
        response = { null }
        show()
        rule.onNodeWithText("Manage in Google Play").assertExists()
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
        rule.onNodeWithText("Keep Plus").assertDoesNotExist()
        rule.onNodeWithText("Website subscription").assertDoesNotExist()
    }

    @Test
    fun goingBackSendsNothing() {
        show()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("Go back").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(0, sent)
        assertEquals(1, reads)
    }

    @Test
    fun theConfirmationPreventsAnotherCancellationWhileSending() {
        cancellationArrives = CompletableDeferred()
        show()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("Cancel Plus").performClick()
        inDialog("Cancel Plus").assertIsNotEnabled()
        inDialog("Go back").assertIsNotEnabled()
        rule.waitForIdle()
        assertEquals(1, sent)
        cancellationArrives?.complete(Unit)
        rule.onNode(isDialog()).assertDoesNotExist()
    }

    @Test
    fun aFailedWebsiteReadCanBeRetriedWithoutShowingTheOffer() {
        subscription = null
        response = { throw ApiException(ApiError.Unavailable, status = 500) }
        show()
        rule.onNodeWithText("This page didn't load").assertExists()
        rule.onNodeWithText("Free offer").assertDoesNotExist()
        response = { web(State.UNPAID) }
        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText("Cancel Plus").assertExists()
        assertEquals(2, reads)
    }

    @Test
    fun aConflictClosesTheDialogWithoutAFalseFailure() {
        answer = MutationResult.Failed(ApiError.Unavailable, "CONFLICT", 409)
        show()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        rule.onNodeWithText(FAILED).assertDoesNotExist()
    }

    @Test
    fun aFailedCancellationCanBeRetried() {
        answer = MutationResult.Failed(ApiError.Unavailable, status = 500)
        show()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        inDialog("Cancel Plus").performClick()
        inDialog(FAILED).assertExists()
        inDialog("Cancel Plus").assertIsEnabled()
        answer = MutationResult.Done(StripeSubscriptionCancellationReceipt(ENDS))
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(2, sent)
    }

    @Test
    fun keepingPlusThatFailsCanBeRetried() {
        keepAnswer = MutationResult.Failed(ApiError.Unavailable, status = 500)
        response = { web(State.ENDING) }
        show()
        rule.onNodeWithText("Keep Plus").performScrollTo().performClick()
        rule.onNodeWithText(KEEP_FAILED).assertExists()
        rule.onNodeWithText("Keep Plus").assertIsEnabled()
    }

    @Test
    fun deletingAnUnpaidWebsitePlanShowsTheNoticeWithoutAnActivePlan() {
        subscription = null
        response = { web(State.UNPAID) }
        profile = true
        show()
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertExists()
    }

    @Test
    fun deletingAnAccountWithBothPlansShowsTheWebsiteNotice() {
        subscription = plan("google")
        profile = true
        show()
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertExists()
    }

    @Test
    fun aFailedDeletionNoticeReadNeverBlocksDeletion() {
        response = { throw ApiException(ApiError.Unavailable, status = 500) }
        profile = true
        show()
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertDoesNotExist()
        rule.onNodeWithText("This page didn't load").assertDoesNotExist()
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun renderPhone() = renderStates("phone")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w800dp-h1000dp-xhdpi")
    fun renderMedium() = renderStates("medium")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun renderExpanded() = renderStates("expanded")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun renderDarkMoreContrast() = renderStates("dark-contrast", dark = true, moreContrast = true)

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun renderLargeFont() {
        assumeTrue(System.getProperty("zoonk.shots").orEmpty().isNotEmpty())
        RuntimeEnvironment.setFontScale(2f)
        renderStates("font200")
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "pl-w411dp-h891dp-xxhdpi")
    fun renderPolishDialog() {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write review screenshots", folder.isNotEmpty())
        show()
        rule.onNodeWithText(rule.activity.getString(R.string.subscription_cancel)).performScrollTo().performClick()
        capture(folder, "polish-paid-dialog", dialog = true)
    }

    private fun renderStates(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write review screenshots", folder.isNotEmpty())
        darkTheme = dark
        higherContrast = moreContrast
        show()
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        capture(folder, "$prefix-paid-dialog", dialog = true)
        inDialog("Go back").performClick()
        capture(folder, "$prefix-renewing")
        update(State.ENDING)
        rule.onNodeWithText("Keep Plus").assertExists()
        capture(folder, "$prefix-ending")
        subscription = null
        update(State.UNPAID)
        rule.onNodeWithText("Your last renewal payment failed.").assertExists()
        capture(folder, "$prefix-unpaid")
        rule.onNodeWithText("Cancel Plus").performScrollTo().performClick()
        capture(folder, "$prefix-unpaid-dialog", dialog = true)
        inDialog("Go back").performClick()
        subscription = plan("google")
        rule.onNodeWithText("Cancel Plus").performScrollTo()
        capture(folder, "$prefix-store-and-website")
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Plus ends right away, and we stop retrying your renewal payment.").assertExists()
        inDialog("Go back").performClick()
        profile = true
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertExists()
        capture(folder, "$prefix-deletion-notice")
    }

    private fun capture(
        folder: String,
        name: String,
        dialog: Boolean = false,
    ) {
        rule.mainClock.advanceTimeByFrame()
        rule.waitForIdle()
        val root = if (dialog) rule.onNode(isDialog()) else rule.onRoot()
        val bitmap = root.captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        const val FAILED = "We couldn't cancel Plus. Try again or email hello@zoonk.com."
        const val KEEP_FAILED = "We couldn't keep Plus. Try again or email hello@zoonk.com."
        val ENDS: Instant = Instant.parse("2026-12-01T12:00:00Z")

        fun web(state: State) = StripeSubscriptionCancellation(if (state == State.UNPAID) null else ENDS, state)

        fun plan(provider: String = "stripe") =
            MeSubscription(
                cancelAt = null,
                cancelAtPeriodEnd = false,
                id = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0d4"),
                periodEnd = ENDS,
                periodStart = null,
                plan = "plus",
                provider = provider,
                status = "active",
            )
    }
}
