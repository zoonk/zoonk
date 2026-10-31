package com.zoonk.android.feature.subscription

import android.app.Activity
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.GUEST
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.account
import com.zoonk.android.data.value
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.FreePlan
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.Money
import com.zoonk.api.models.StoreSubscriptionResponse
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import com.zoonk.api.models.StripeSubscriptionCancellationRequest.Choice
import com.zoonk.api.models.StripeSubscriptionCancellationWithdrawal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import java.util.UUID
import kotlin.time.Instant

private fun subscribed(
    id: String,
    provider: String = "google",
    cancelAt: Instant? = null,
): MeResponse =
    account(id).let {
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
        it.copy(account = it.account.copy(hasActiveSubscription = true, subscription = subscription))
    }

private class FakePlayBilling : PlayBilling {
    val bought = mutableListOf<Pair<BillingPeriod, String>>()
    var unlinked = listOf<String>()
    var offerReads = 0
    override val updates = MutableSharedFlow<PlayPurchaseUpdate>(extraBufferCapacity = 4)

    override suspend fun offers(): PlusOffers {
        offerReads++
        return PlusOffers(
            PlusOffer(BillingPeriod.Monthly, "monthly-token", "$5.00", 5_000_000, "USD"),
            PlusOffer(BillingPeriod.Yearly, "yearly-token", "$40.00", 40_000_000, "USD"),
            product = Unit,
        )
    }

    override suspend fun buy(
        activity: Activity,
        offers: PlusOffers,
        offer: PlusOffer,
        accountId: String,
    ): Boolean {
        bought += offer.period to accountId
        return true
    }

    override suspend fun unacknowledgedPurchases(): List<String> = unlinked
}

private class FakeSubscriptionApi : SubscriptionApi {
    val linked = mutableListOf<Pair<String, String>>()
    var failure: ApiException? = null
    var accountRead: suspend (AuthenticatedSession) -> MeResponse = { account(it.accountId) }

    override suspend fun account(session: AuthenticatedSession): MeResponse = accountRead(session)

    override suspend fun allowance(session: AuthenticatedSession): AllowanceResponse = throw UnsupportedOperationException()

    override suspend fun freePlan(): FreePlan = throw UnsupportedOperationException()

    override suspend fun linkGooglePlay(
        session: AuthenticatedSession,
        purchaseToken: String,
    ): StoreSubscriptionResponse {
        failure?.let { throw it }
        linked += session.bearerToken to purchaseToken
        return StoreSubscriptionResponse(subscribed(session.accountId), isActive = true)
    }

    var cancellationRead: suspend () -> StripeSubscriptionCancellation = { throw UnsupportedOperationException() }
    val canceled = mutableListOf<Pair<String, Choice>>()
    var cancelFailure: ApiException? = null

    override suspend fun webPlusCancellation(session: AuthenticatedSession): StripeSubscriptionCancellation = cancellationRead()

    override suspend fun cancelWebPlus(
        session: AuthenticatedSession,
        choice: Choice,
    ): StripeSubscriptionCancellationReceipt {
        cancelFailure?.let { throw it }
        canceled += session.bearerToken to choice
        return RECEIPT
    }
}

private val RECEIPT =
    StripeSubscriptionCancellationReceipt(
        endsAt = Instant.parse("2026-10-31T12:00:00Z"),
        receivedAt = Instant.parse("2026-10-31T12:00:00Z"),
        refund = Money(29.9, "BRL"),
    )

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class SubscriptionStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val billing = FakePlayBilling()
    private val api = FakeSubscriptionApi()
    private val foreground = MutableStateFlow(false)

    private suspend fun TestScope.store(
        session: AuthenticatedSession,
        isGuest: Boolean = false,
    ): Pair<SessionStore, SubscriptionStore> {
        val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += session.bearerToken to session.accountId },
                MemoryCredentials(StoredSession(session, isGuest)),
                DraftStore(folder.newFolder(), main, io = StandardTestDispatcher(testScheduler)),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        sessions.restore()
        val store = SubscriptionStore(api, billing, sessions, AppCache(sessions, main), main, foreground)
        store.offers.load()
        advanceUntilIdle()
        return sessions to store
    }

    private val activity: Activity = Robolectric.buildActivity(Activity::class.java).get()
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")

    @Test
    fun aPurchaseIsLinkedToTheAccountThatMadeItAndShowsPlus() =
        runTest {
            val (sessions, store) = store(ana)

            store.buy(activity, BillingPeriod.Yearly)
            assertEquals(listOf(BillingPeriod.Yearly to ANA), billing.bought)
            assertEquals(PurchaseState.Buying, store.purchase.value)

            billing.updates.emit(PlayPurchaseUpdate.Purchased("purchase-1"))
            advanceUntilIdle()

            assertEquals(listOf("token-a" to "purchase-1"), api.linked)
            assertEquals(PurchaseState.Done, store.purchase.value)
            assertNotNull((sessions.state.value as SessionState.SignedIn).account.account.subscription)
            assertNotNull(
                store.account.state.value.value
                    ?.account
                    ?.subscription,
            )
        }

    @Test
    fun anotherAccountsPurchaseIsSaidSoInsteadOfRetried() =
        runTest {
            val (_, store) = store(ana)
            api.failure = ApiException(ApiError.Unavailable, "GOOGLE_PLAY_ACCOUNT_MISMATCH", 409)

            billing.updates.emit(PlayPurchaseUpdate.Purchased("purchase-1"))
            advanceUntilIdle()

            assertEquals(PurchaseState.OtherAccount, store.purchase.value)
        }

    @Test
    fun purchasesNotLinkedYetAreLinkedWhenTheAppComesToTheForeground() =
        runTest {
            val (_, store) = store(ana)
            billing.unlinked = listOf("from-the-play-store")

            foreground.value = true
            advanceUntilIdle()

            assertEquals(listOf("token-a" to "from-the-play-store"), api.linked)
            assertEquals(PurchaseState.Done, store.purchase.value)
        }

    @Test
    fun anAccountSignedInWhileInTheForegroundLinksWhatPlayHolds() =
        runTest {
            val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val sessionApi = FakeSessionApi().apply { accounts += "token-a" to ANA }
            val sessions =
                SessionStore(
                    sessionApi,
                    MemoryCredentials(),
                    DraftStore(
                        folder.newFolder(),
                        main,
                        io = StandardTestDispatcher(testScheduler),
                    ),
                    { _, _ -> },
                    {
                    },
                )
            sessions.restore()
            SubscriptionStore(api, billing, sessions, AppCache(sessions, main), main, foreground)
            billing.unlinked = listOf("from-the-play-store")
            foreground.value = true
            advanceUntilIdle()
            assertTrue(api.linked.isEmpty())

            sessions.signIn { "token-a" }
            advanceUntilIdle()

            assertEquals(listOf("token-a" to "from-the-play-store"), api.linked)
        }

    @Test
    fun aGuestNeverLinksAPurchaseEvenFromPlaysCallback() =
        runTest {
            val (_, store) = store(AuthenticatedSession(GUEST, "token-guest", "local-g"), isGuest = true)
            billing.unlinked = listOf("from-the-play-store")

            store.buy(activity, BillingPeriod.Monthly)
            foreground.value = true
            billing.updates.emit(PlayPurchaseUpdate.Purchased("out-of-app"))
            advanceUntilIdle()

            assertTrue(billing.bought.isEmpty())
            assertTrue(api.linked.isEmpty())
        }

    @Test
    fun aCheckoutReadsPlaysOffersAgain() =
        runTest {
            val (_, store) = store(ana)
            val reads = billing.offerReads

            store.buy(activity, BillingPeriod.Monthly)

            assertEquals(reads + 1, billing.offerReads)
            assertEquals(listOf(BillingPeriod.Monthly to ANA), billing.bought)
        }

    @Test
    fun aWithdrawalIsSentWithTheSessionsTokenAndShowsThePlanWithoutPlus() =
        runTest {
            val (_, store) = store(ana)
            api.accountRead = { subscribed(it.accountId, provider = "stripe") }
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()

            api.accountRead = { account(it.accountId) }
            val result = store.cancelWebPlus(Choice.WITHDRAWAL)
            advanceUntilIdle()

            assertEquals(MutationResult.Done(RECEIPT), result)
            assertEquals(listOf("token-a" to Choice.WITHDRAWAL), api.canceled)
            assertNull(
                store.account.state.value.value
                    ?.account
                    ?.subscription,
            )
            shown.cancel()
        }

    @Test
    fun nothingLeftToCancelReadsThePlanAgainEvenWhileAnOlderReadIsOnItsWay() =
        runTest {
            val (_, store) = store(ana)
            val olderRead = CompletableDeferred<MeResponse>()
            api.accountRead = { olderRead.await() }
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()

            api.cancellationRead = { throw ApiException(ApiError.NotFound, status = 404) }
            api.accountRead = { subscribed(it.accountId, provider = "stripe", cancelAt = ENDS) }
            val result = store.webPlusCancellation()
            advanceUntilIdle()
            olderRead.complete(subscribed(ANA, provider = "stripe"))
            advanceUntilIdle()

            assertEquals(ApiError.NotFound, (result as MutationResult.Failed).error)
            assertEquals(
                ENDS,
                store.account.state.value.value
                    ?.account
                    ?.subscription
                    ?.cancelAt,
            )
            shown.cancel()
        }

    @Test
    fun aChoiceThatClosedMeanwhileReadsThePlanAgain() =
        runTest {
            val (_, store) = store(ana)
            api.accountRead = { subscribed(it.accountId, provider = "stripe") }
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()

            api.cancelFailure = ApiException(ApiError.Unavailable, "CONFLICT", 409)
            api.accountRead = { subscribed(it.accountId, provider = "stripe", cancelAt = ENDS) }
            val result = store.cancelWebPlus(Choice.WITHDRAWAL)
            advanceUntilIdle()

            assertEquals(409, (result as MutationResult.Failed).status)
            assertTrue(api.canceled.isEmpty())
            assertEquals(
                ENDS,
                store.account.state.value.value
                    ?.account
                    ?.subscription
                    ?.cancelAt,
            )
            shown.cancel()
        }

    @Test
    fun aRefundThatClosedMeanwhileIsDroppedThoughThePlanStaysTheSame() =
        runTest {
            val (_, store) = store(ana)
            api.accountRead = { subscribed(it.accountId, provider = "stripe", cancelAt = ENDS) }
            api.cancellationRead = { StripeSubscriptionCancellation(cancellation = null, extraordinary = null, withdrawal = WITHDRAWAL) }
            val shown = launch { store.endingWebPlusChoices.shown.collect {} }
            advanceUntilIdle()
            assertNotNull(
                store.endingWebPlusChoices.state.value.value
                    ?.withdrawal,
            )

            api.cancelFailure = ApiException(ApiError.Unavailable, "CONFLICT", 409)
            api.cancellationRead = { StripeSubscriptionCancellation(cancellation = null, extraordinary = null, withdrawal = null) }
            store.cancelWebPlus(Choice.WITHDRAWAL)
            advanceUntilIdle()

            assertNull(
                store.endingWebPlusChoices.state.value.value
                    ?.withdrawal,
            )
            shown.cancel()
        }

    @Test
    fun anotherAccountStartsWithoutTheLastOnesPurchaseState() =
        runTest {
            val (sessions, store) = store(ana)
            store.buy(activity, BillingPeriod.Yearly)
            assertEquals(PurchaseState.Buying, store.purchase.value)

            sessions.signOut()
            advanceUntilIdle()

            assertEquals(PurchaseState.Idle, store.purchase.value)
        }

    private companion object {
        val ENDS = Instant.parse("2026-12-01T00:00:00Z")
        val WITHDRAWAL =
            StripeSubscriptionCancellationWithdrawal(refund = Money(29.9, "BRL"), until = Instant.parse("2026-11-14T12:00:00Z"))
    }
}
