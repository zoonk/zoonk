package com.zoonk.android.feature.subscription

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
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
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.test.ext.junit.runners.AndroidJUnit4
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
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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

    private var status: MutationResult<StripeSubscriptionCancellation> =
        MutationResult.Done(cancellationStatus())
    private var answer: MutationResult<StripeSubscriptionCancellationReceipt> = MutationResult.Done(RECEIPT)
    private var statusArrives: CompletableDeferred<Unit>? = null
    private var cancellationArrives: CompletableDeferred<Unit>? = null
    private var darkTheme = false
    private var higherContrast = false
    private var sent = 0
    private var keepAnswer: MutationResult<Unit> = MutationResult.Done(Unit)
    private var keeps = 0
    private var subscription by mutableStateOf<MeSubscription?>(null)
    private var endingStatus: () -> StripeSubscriptionCancellation = { cancellationStatus() }
    private var endingReads = 0
    private val endingWebPlusStatus =
        AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
            .resource(Audience.SignedIn) {
                endingReads++
                endingStatus()
            }

    private fun show(
        provider: String = "stripe",
        cancelAt: Instant? = null,
        cancelAtPeriodEnd: Boolean = cancelAt != null,
    ) {
        subscription = plan(provider, cancelAt, cancelAtPeriodEnd)
        rule.setContent {
            ZoonkTheme(darkTheme = darkTheme, moreContrast = higherContrast) {
                Surface {
                    val cancellation =
                        viewModel {
                            WebPlusCancellationViewModel(
                                readStatus = {
                                    statusArrives?.await()
                                    status
                                },
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
                    Column { subscription?.let { CurrentPlan(it, rememberAppNavigator(), cancellation, endingWebPlusStatus) } }
                }
            }
        }
    }

    private fun inDialog(text: String) = rule.onNode(hasText(text) and hasAnyAncestor(isDialog()))

    @Test
    fun aPaidCancellationShowsTheEndDateAndCanBeUndone() {
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Cancel Plus?").assertExists()
        inDialog("You keep Plus until the end of the period you already paid for.").assertExists()
        inDialog("Cancel Plus").performClick()
        rule.waitForIdle()
        assertEquals(1, sent)
        endingStatus = { cancellationStatus(ending = true) }
        subscription = plan(cancelAt = ENDS)

        rule.onNode(isDialog()).assertDoesNotExist()
        rule.onNodeWithText("Your subscription will end on Dec 1, 2026.").assertExists()
        rule.onNodeWithText("Keep Plus").performClick()
        rule.waitForIdle()
        assertEquals(1, keeps)
        assertEquals(1, endingReads)
    }

    @Test
    fun anUnpaidRenewalEndsImmediatelyWithoutAReceiptDialog() {
        status = MutationResult.Done(cancellationStatus(unpaid = true))
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Plus ends right away, and we stop retrying your renewal payment.").assertExists()
        inDialog("Cancel Plus").performClick()
        subscription = null

        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(1, sent)
    }

    @Test
    fun goingBackSendsNothing() {
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Go back").performClick()

        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(0, sent)
    }

    @Test
    fun theButtonWaitsForTheStatus() {
        statusArrives = CompletableDeferred()
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        rule.onNodeWithText("Cancel Plus").assertIsNotEnabled()
        statusArrives?.complete(Unit)
        inDialog("Cancel Plus?").assertExists()
    }

    @Test
    fun theConfirmationWaitsAndPreventsAnotherCancellation() {
        cancellationArrives = CompletableDeferred()
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Cancel Plus").performClick()
        inDialog("Cancel Plus").assertIsNotEnabled()
        inDialog("Go back").assertIsNotEnabled()
        rule.waitForIdle()
        assertEquals(1, sent)
        cancellationArrives?.complete(Unit)
        rule.onNode(isDialog()).assertDoesNotExist()
    }

    @Test
    fun nothingLeftToCancelOpensNothing() {
        status = MutationResult.Failed(ApiError.NotFound, status = 404)
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        rule.onNodeWithText(FAILED).assertDoesNotExist()
    }

    @Test
    fun anAlreadyScheduledCancellationOpensNothing() {
        status = MutationResult.Done(cancellationStatus(ending = true))
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(0, sent)
    }

    @Test
    fun statusThatWontLoadCanBeRetried() {
        status = MutationResult.Failed(ApiError.Unavailable, status = 500)
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        rule.onNodeWithText(FAILED).assertExists()
        rule.onNodeWithText("Cancel Plus").assertIsEnabled()
        status = MutationResult.Done(cancellationStatus())
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Cancel Plus?").assertExists()
    }

    @Test
    fun aSubscriptionThatChangedMeanwhileClosesTheDialog() {
        answer = MutationResult.Failed(ApiError.Unavailable, "CONFLICT", 409)
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        rule.onNodeWithText(FAILED).assertDoesNotExist()
    }

    @Test
    fun aFailedCancellationKeepsTheConfirmationForRetry() {
        answer = MutationResult.Failed(ApiError.Unavailable, status = 500)
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Cancel Plus").performClick()
        inDialog(FAILED).assertExists()
        inDialog("Cancel Plus").assertIsEnabled()
        answer = MutationResult.Done(RECEIPT)
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
        assertEquals(2, sent)
    }

    @Test
    fun anObsoleteCancellationClosesTheOldAccountsDialog() {
        answer = MutationResult.Obsolete
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        inDialog("Cancel Plus").performClick()
        rule.onNode(isDialog()).assertDoesNotExist()
    }

    @Test
    fun aPeriodEndCancellationWithoutCancelAtStillOffersKeepPlus() {
        endingStatus = { cancellationStatus(ending = true) }
        show(cancelAtPeriodEnd = true)
        rule.onNodeWithText("Subscription ending").assertExists()
        rule.onNodeWithText("Your subscription will end on Dec 1, 2026.").assertExists()
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
        rule.onNodeWithText("Keep Plus").assertExists()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun anEndingSubscriptionWhoseStatusWontLoadOffersToTryAgain() {
        endingStatus = { throw ApiException(ApiError.Unavailable, status = 500) }
        show(cancelAt = ENDS)
        rule.onNodeWithText("This page didn't load").assertExists()
        endingStatus = { cancellationStatus(ending = true) }
        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText("Keep Plus").assertExists()
        rule.waitForIdle()
        assertEquals(2, endingReads)
    }

    @Test
    fun anEndingSubscriptionThatCantBeKeptShowsNoAction() {
        show(cancelAt = ENDS)
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
        rule.onNodeWithText("Keep Plus").assertDoesNotExist()
    }

    @Test
    fun keepingPlusThatFailsCanBeRetried() {
        keepAnswer = MutationResult.Failed(ApiError.Unavailable, status = 500)
        endingStatus = { cancellationStatus(ending = true) }
        show(cancelAt = ENDS)
        rule.onNodeWithText("Keep Plus").performClick()
        rule.onNodeWithText(KEEP_FAILED).assertExists()
        rule.onNodeWithText("Keep Plus").assertIsEnabled()
    }

    @Test
    fun keepingPlusThatCantBeKeptAnymoreShowsNoError() {
        keepAnswer = MutationResult.Failed(ApiError.Unavailable, "CONFLICT", 409)
        endingStatus = { cancellationStatus(ending = true) }
        show(cancelAt = ENDS)
        rule.onNodeWithText("Keep Plus").performClick()
        rule.waitForIdle()
        assertEquals(1, keeps)
        rule.onNodeWithText(KEEP_FAILED).assertDoesNotExist()
    }

    @Test
    fun deletingTheAccountNeedsNoStripeRead() {
        showDeletionNotice()
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertExists()
        assertEquals(0, endingReads)
    }

    @Test
    fun deletingAPlayAccountShowsNoWebsiteNotice() {
        showDeletionNotice(provider = "google")
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertDoesNotExist()
        assertEquals(0, endingReads)
    }

    private fun showDeletionNotice(provider: String = "stripe") {
        rule.setContent {
            ZoonkTheme { webPlusDeletionNotice(plan(provider))?.let { Text(it) } }
        }
    }

    @Test
    fun aPlayPlusIsManagedInPlayWithoutAskingStripe() {
        show("google", cancelAt = ENDS)
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
        rule.onNodeWithText("Manage in Google Play").assertExists()
        assertEquals(0, endingReads)
    }

    @Test
    fun anApplePlusIsManagedInTheAppStoreWithoutAskingStripe() {
        show("apple", cancelAt = ENDS)
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
        rule.onNodeWithText("Keep Plus").assertDoesNotExist()
        rule.onNodeWithText("This subscription is managed through the App Store.", substring = true).assertExists()
        assertEquals(0, endingReads)
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun renderPhone() = renderCancellation("phone")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w800dp-h1000dp-xhdpi")
    fun renderMedium() = renderCancellation("medium")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun renderExpanded() = renderCancellation("expanded")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun renderDarkMoreContrast() = renderCancellation("dark-contrast", dark = true, moreContrast = true)

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun renderLargeFont() {
        assumeTrue(System.getProperty("zoonk.shots").orEmpty().isNotEmpty())
        RuntimeEnvironment.setFontScale(2f)
        renderCancellation("font200")
    }

    private fun renderCancellation(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write review screenshots", folder.isNotEmpty())
        darkTheme = dark
        higherContrast = moreContrast
        endingStatus = { cancellationStatus(ending = true) }
        show()
        rule.onNodeWithText("Cancel Plus").performClick()
        capture(folder, "$prefix-paid-dialog", dialog = true)
        inDialog("Go back").performClick()
        capture(folder, "$prefix-active", dialog = false)
        status = MutationResult.Done(cancellationStatus(unpaid = true))
        rule.onNodeWithText("Cancel Plus").performClick()
        capture(folder, "$prefix-unpaid-dialog", dialog = true)
        inDialog("Go back").performClick()
        subscription = plan(cancelAt = ENDS)
        rule.onNodeWithText("Keep Plus").assertExists()
        capture(folder, "$prefix-ending", dialog = false)
    }

    private fun capture(
        folder: String,
        name: String,
        dialog: Boolean,
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
        val RECEIPT =
            ApiJson.decodeFromString<StripeSubscriptionCancellationReceipt>(
                """{"endsAt":"2026-12-01T12:00:00Z","receivedAt":"2026-11-01T12:00:00Z"}""",
            )

        fun cancellationStatus(
            ending: Boolean = false,
            unpaid: Boolean = false,
        ): StripeSubscriptionCancellation =
            ApiJson.decodeFromString(
                """{"cancellation":${if (ending) """{"endsAt":"2026-12-01T12:00:00Z"}""" else "null"},"unpaid":$unpaid,"canResumeRenewal":$ending}""",
            )

        fun plan(
            provider: String = "stripe",
            cancelAt: Instant? = null,
            cancelAtPeriodEnd: Boolean = cancelAt != null,
        ) = MeSubscription(
            cancelAt = cancelAt,
            cancelAtPeriodEnd = cancelAtPeriodEnd,
            id = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0d4"),
            periodEnd = ENDS,
            periodStart = null,
            plan = "plus",
            provider = provider,
            status = "active",
        )
    }
}
