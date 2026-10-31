package com.zoonk.android.feature.subscription

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.Money
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationExtraordinary
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import com.zoonk.api.models.StripeSubscriptionCancellationRequest.Choice
import com.zoonk.api.models.StripeSubscriptionCancellationWithdrawal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.Locale
import java.util.UUID
import kotlin.time.Instant

@RunWith(AndroidJUnit4::class)
class WebPlusCancellationTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var options: MutationResult<StripeSubscriptionCancellation> =
        MutationResult.Done(choices(cancellation = AT_PERIOD_END, withdrawal = WITHDRAWAL))
    private var answer: MutationResult<StripeSubscriptionCancellationReceipt> = MutationResult.Done(receipt(REFUND))
    private var optionsArrive: CompletableDeferred<Unit>? = null
    private val sent = mutableListOf<Choice>()
    private var subscription by mutableStateOf<MeSubscription?>(null)
    private var endingChoices: () -> StripeSubscriptionCancellation = { choices(cancellation = null, withdrawal = WITHDRAWAL) }
    private var endingReads = 0
    private val endingWebPlusChoices =
        AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
            .resource(Audience.SignedIn) {
                endingReads++
                endingChoices()
            }

    private fun show(
        provider: String = "stripe",
        cancelAt: Instant? = null,
    ) {
        subscription =
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
                val cancellation =
                    viewModel {
                        WebPlusCancellationViewModel(
                            readOptions = {
                                optionsArrive?.await()
                                options
                            },
                            send = {
                                sent += it
                                answer
                            },
                        )
                    }
                WebPlusCancellationDialog(cancellation)
                Column { subscription?.let { CurrentPlan(it, rememberAppNavigator(), cancellation, endingWebPlusChoices) } }
            }
        }
    }

    private fun inDialog(text: String) = rule.onNode(hasText(text) and hasAnyAncestor(isDialog()))

    @Test
    fun aNewWebPlusIsWithdrawnWithAFullRefundAndTheReceiptStaysOnceItEnds() {
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        inDialog("Cancel Plus?").assertExists()
        inDialog("Until Nov 14, 2026, you can get a full refund of R$29.90. Plus ends right away.").assertExists()
        inDialog("You keep Plus until Nov 21, 2026, then it ends. You won't be charged again.").assertExists()
        inDialog("We'll email you the confirmation.").assertExists()
        inDialog("Confirm withdrawal").performClick()
        subscription = null

        assertEquals(listOf(Choice.WITHDRAWAL), sent)
        assertEquals(0, endingReads)
        inDialog("We've refunded R$29.90 to the payment method you used. Plus is canceled. We emailed you the confirmation.")
            .assertExists()
        inDialog("OK").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
    }

    @Test
    fun aRenewalStoppedAfterAYearlyRenewalRefundsTheMonthsNotStarted() {
        options = MutationResult.Done(choices(cancellation = AT_PERIOD_END.copy(refund = REFUND), withdrawal = null))
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        inDialog("You keep Plus until Nov 21, 2026. We refund R$29.90 for the months that haven't started.").assertExists()
        inDialog("Confirm withdrawal").assertDoesNotExist()
        inDialog("Cancel now").performClick()

        assertEquals(listOf(Choice.ORDINARY), sent)
    }

    @Test
    fun aStoppedRenewalWithoutRefundSaysPlusIsCanceled() {
        answer = MutationResult.Done(receipt(refund = null))
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        inDialog("Cancel now").performClick()

        inDialog("Plus is canceled. We emailed you the confirmation.").assertExists()
    }

    @Test
    fun keepingPlusSendsNothing() {
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        inDialog("Keep Plus").performClick()

        rule.onNode(isDialog()).assertDoesNotExist()
        assertTrue(sent.isEmpty())
    }

    @Test
    fun theButtonWaitsForTheOptions() {
        optionsArrive = CompletableDeferred()
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        rule.onNodeWithText("Cancel subscription").assertIsNotEnabled()
        optionsArrive?.complete(Unit)

        inDialog("Cancel Plus?").assertExists()
    }

    @Test
    fun nothingLeftToCancelOpensNothing() {
        options = MutationResult.Failed(ApiError.NotFound, status = 404)
        show()

        rule.onNodeWithText("Cancel subscription").performClick()

        rule.onNode(isDialog()).assertDoesNotExist()
        rule.onNodeWithText(FAILED).assertDoesNotExist()
    }

    @Test
    fun optionsThatWontLoadSayWhomToContact() {
        options = MutationResult.Failed(ApiError.Unavailable, status = 500)
        show()

        rule.onNodeWithText("Cancel subscription").performClick()

        rule.onNodeWithText(FAILED).assertExists()
        rule.onNodeWithText("Cancel subscription").assertIsEnabled()
    }

    @Test
    fun anOptionThatClosedMeanwhileSaysSo() {
        answer = MutationResult.Failed(ApiError.Unavailable, "CONFLICT", 409)
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        inDialog("Confirm withdrawal").performClick()

        inDialog("That option isn't available anymore.").assertExists()
    }

    @Test
    fun aCancellationThatFailsKeepsTheChoicesAndSaysWhomToContact() {
        answer = MutationResult.Failed(ApiError.Unavailable, status = 500)
        show()

        rule.onNodeWithText("Cancel subscription").performClick()
        inDialog("Confirm withdrawal").performClick()

        inDialog(FAILED).assertExists()
        inDialog("Confirm withdrawal").assertIsEnabled()
    }

    @Test
    @Config(qualifiers = "de")
    fun germanCancelButtonsReadAsGermanLawRequires() {
        show()

        rule.onNodeWithText("Abo kündigen").performClick()

        inDialog("Widerruf bestätigen").assertExists()
        inDialog("Jetzt kündigen").assertExists()
    }

    @Test
    fun theWithdrawalButtonUsesTheDirectivesWordingInEveryLanguage() {
        mapOf(
            "de" to "Widerruf bestätigen",
            "es" to "Confirmar desistimiento",
            "fr" to "Confirmer la rétractation",
            "pt" to "Confirmar retratação",
        ).forEach { (language, label) ->
            val configuration = Configuration().apply { setLocale(Locale.forLanguageTag(language)) }
            assertEquals(label, rule.activity.createConfigurationContext(configuration).getString(R.string.subscription_cancel_withdraw))
        }
    }

    @Test
    fun aStoppedRenewalStillOffersTheFullRefundUntilItsLastDay() {
        show(cancelAt = ENDS)

        rule.onNodeWithText("Cancel subscription").assertDoesNotExist()
        rule.onNodeWithText("Until Nov 14, 2026, you can still end Plus now and get a full refund.").assertExists()
        rule.onNodeWithText("Get a full refund").performClick()
        inDialog("Until Nov 14, 2026, you can get a full refund of R$29.90. Plus ends right away.").assertExists()
        inDialog("Cancel now").assertDoesNotExist()
        inDialog("Confirm withdrawal").performClick()

        assertEquals(listOf(Choice.WITHDRAWAL), sent)
        assertEquals(1, endingReads)
        inDialog("We've refunded R$29.90 to the payment method you used. Plus is canceled. We emailed you the confirmation.")
            .assertExists()
    }

    @Test
    fun aStoppedRenewalPastTheRefundHasNothingToCancel() {
        endingChoices = { choices(cancellation = null, withdrawal = null) }
        show(cancelAt = ENDS)

        rule.waitForIdle()
        assertEquals(1, endingReads)
        rule.onNodeWithText("Cancel subscription").assertDoesNotExist()
        rule.onNodeWithText("Get a full refund").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aStoppedRenewalWhoseChoicesWontLoadOffersToTryAgain() {
        endingChoices = { throw ApiException(ApiError.Unavailable, status = 500) }
        show(cancelAt = ENDS)

        rule.onNodeWithText("This page didn't load").assertExists()
        rule.onNodeWithText("Get a full refund").assertDoesNotExist()
        endingChoices = { choices(cancellation = null, withdrawal = WITHDRAWAL) }
        rule.onNodeWithText("Try again").performClick()

        rule.onNodeWithText("Get a full refund").assertExists()
        rule.onNodeWithText("This page didn't load").assertDoesNotExist()
        assertEquals(2, endingReads)
    }

    @Test
    fun aStoppedRenewalWithNothingLeftToCancelShowsNoError() {
        endingChoices = { throw ApiException(ApiError.NotFound, status = 404) }
        show(cancelAt = ENDS)

        rule.waitForIdle()
        assertEquals(1, endingReads)
        rule.onNodeWithText("This page didn't load").assertDoesNotExist()
        rule.onNodeWithText("Get a full refund").assertDoesNotExist()
    }

    @Test
    fun aPlayPlusIsManagedInPlayWithoutAskingStripe() {
        show("google", cancelAt = ENDS)

        rule.onNodeWithText("Cancel subscription").assertDoesNotExist()
        rule.onNodeWithText("Manage in Google Play").assertExists()
        assertEquals(0, endingReads)
    }

    private companion object {
        const val FAILED = "Unable to manage your subscription. Contact us at hello@zoonk.com"
        val REFUND = Money(29.9, "BRL")
        val ENDS: Instant = Instant.parse("2026-12-01T00:00:00Z")
        val WITHDRAWAL = StripeSubscriptionCancellationWithdrawal(refund = REFUND, until = Instant.parse("2026-11-14T12:00:00Z"))
        val AT_PERIOD_END = StripeSubscriptionCancellationCancellation(endsAt = Instant.parse("2026-11-21T12:00:00Z"), refund = null)

        fun choices(
            cancellation: StripeSubscriptionCancellationCancellation?,
            withdrawal: StripeSubscriptionCancellationWithdrawal?,
        ) = StripeSubscriptionCancellation(
            cancellation = cancellation,
            extraordinary = StripeSubscriptionCancellationExtraordinary(refund = REFUND),
            withdrawal = withdrawal,
        )

        fun receipt(refund: Money?) =
            StripeSubscriptionCancellationReceipt(
                endsAt = Instant.parse("2026-10-31T12:00:00Z"),
                receivedAt = Instant.parse("2026-10-31T12:00:00Z"),
                refund = refund,
            )
    }
}
