package com.zoonk.android.feature.subscription

import android.app.Activity
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.GUEST
import com.zoonk.android.data.LoadState
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
import com.zoonk.api.models.StoreSubscriptionResponse
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellation.State
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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

internal class FakePlayBilling : PlayBilling {
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

internal class FakeSubscriptionApi : SubscriptionApi {
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

    var websiteRead: suspend () -> StripeSubscriptionCancellation = { throw ApiException(ApiError.NotFound, status = 404) }
    var websiteReads = 0
    val canceled = mutableListOf<String>()
    var cancelFailure: ApiException? = null

    override suspend fun websiteSubscription(session: AuthenticatedSession): StripeSubscriptionCancellation {
        websiteReads++
        return websiteRead()
    }

    override suspend fun cancelWebPlus(session: AuthenticatedSession): StripeSubscriptionCancellationReceipt {
        cancelFailure?.let { throw it }
        canceled += session.bearerToken
        return RECEIPT
    }

    val kept = mutableListOf<String>()
    var keepAnswer: suspend () -> Unit = {}

    override suspend fun keepWebPlus(session: AuthenticatedSession) {
        keepAnswer()
        kept += session.bearerToken
    }
}

private val ENDS = Instant.parse("2026-12-01T00:00:00Z")
private val RECEIPT = StripeSubscriptionCancellationReceipt(endsAt = ENDS)

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class SubscriptionStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val billing = FakePlayBilling()
    private val api = FakeSubscriptionApi()
    private val foreground = MutableStateFlow(false)
    private lateinit var cache: AppCache

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
        cache = AppCache(sessions, main)
        val store = SubscriptionStore(api, billing, sessions, cache, main, foreground)
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
    fun aLinkedPurchaseRereadsTheCertificatesItIssued() =
        runTest {
            store(ana)
            var reads = 0
            val certificates = cache.resource(Audience.SignedIn, setOf(DataDomain.Certificates)) { session -> session?.let { ++reads } }
            certificates.load()

            billing.updates.emit(PlayPurchaseUpdate.Purchased("purchase-1"))
            advanceUntilIdle()
            certificates.load()

            assertEquals(2, reads)
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
    fun plusBoughtAnywhereSinceThePlanWasReadIsNeverBoughtAgainOnPlay() =
        runTest {
            val (_, store) = store(ana)
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()

            listOf("stripe", "apple", "google", "zoonk").forEach { provider ->
                api.accountRead = { subscribed(it.accountId, provider = provider) }
                store.buy(activity, BillingPeriod.Monthly)

                assertEquals(PurchaseState.AlreadyPlus, store.purchase.value)
                assertEquals(
                    provider,
                    store.account.state.value.value
                        ?.account
                        ?.subscription
                        ?.provider,
                )
            }
            assertTrue(billing.bought.isEmpty())
            shown.cancel()
        }

    @Test
    fun aPlanThatCantBeReadAgainNeverOpensPlayFromTheCachedOne() =
        runTest {
            val (_, store) = store(ana)
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()
            api.accountRead = { throw ApiException(ApiError.Network) }

            store.buy(activity, BillingPeriod.Monthly)

            assertTrue(billing.bought.isEmpty())
            assertEquals(PurchaseState.PlanCheckFailed, store.purchase.value)
            shown.cancel()
        }

    @Test
    fun aPlusLinkedWhileThePlanWasReadIsKeptOverTheOlderReadAndNeverBoughtAgain() =
        runTest {
            val (_, store) = store(ana)
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()
            val planRead = CompletableDeferred<MeResponse>()
            api.accountRead = { planRead.await() }

            val checkout = launch { store.buy(activity, BillingPeriod.Monthly) }
            advanceUntilIdle()
            billing.updates.emit(PlayPurchaseUpdate.Purchased("out-of-app"))
            advanceUntilIdle()
            planRead.complete(account(ANA))
            advanceUntilIdle()

            assertTrue(checkout.isCompleted)
            assertTrue(billing.bought.isEmpty())
            assertEquals(PurchaseState.AlreadyPlus, store.purchase.value)
            assertNotNull(
                store.account.state.value.value
                    ?.account
                    ?.subscription,
            )
            shown.cancel()
        }

    @Test
    fun aCheckoutWhoseSessionEndedWhileThePlanWasReadOpensNothing() =
        runTest {
            val (sessions, store) = store(ana)
            val planRead = CompletableDeferred<MeResponse>()
            api.accountRead = { planRead.await() }

            val checkout = launch { store.buy(activity, BillingPeriod.Monthly) }
            advanceUntilIdle()
            sessions.signOut()
            planRead.complete(subscribed(ANA, provider = "stripe"))
            advanceUntilIdle()

            assertTrue(checkout.isCompleted)
            assertTrue(billing.bought.isEmpty())
            assertEquals(PurchaseState.Idle, store.purchase.value)
        }

    @Test
    fun aCancellationIsSentWithTheSessionsTokenAndShowsThePlanWithoutPlus() =
        runTest {
            val (_, store) = store(ana)
            api.accountRead = { subscribed(it.accountId, provider = "stripe") }
            val shown = launch { store.account.shown.collect {} }
            advanceUntilIdle()

            api.accountRead = { account(it.accountId) }
            val result = store.cancelWebPlus()
            advanceUntilIdle()

            assertEquals(MutationResult.Done(RECEIPT), result)
            assertEquals(listOf("token-a"), api.canceled)
            assertNull(
                store.account.state.value.value
                    ?.account
                    ?.subscription,
            )
            shown.cancel()
        }

    @Test
    fun cancelingAnUnpaidWebsitePlanRefreshesToNoWebsitePlan() =
        runTest {
            val (_, store) = store(ana)
            api.websiteRead = { StripeSubscriptionCancellation(null, State.UNPAID) }
            val shown = launch { store.websiteSubscription.shown.collect {} }
            advanceUntilIdle()

            api.websiteRead = { throw ApiException(ApiError.NotFound, status = 404) }
            store.cancelWebPlus()
            advanceUntilIdle()

            assertEquals(LoadState.Empty, store.websiteSubscription.state.value)
            assertEquals(2, api.websiteReads)
            shown.cancel()
        }

    @Test
    fun aGuestsUnavailableCancellationDoesNotSignOut() =
        runTest {
            val (sessions, store) = store(AuthenticatedSession(GUEST, "token-guest", "local-g"), isGuest = true)
            api.cancelFailure = ApiException(ApiError.NotFound, status = 404)
            api.keepAnswer = { throw ApiException(ApiError.NotFound, status = 404) }

            assertEquals(404, (store.cancelWebPlus() as MutationResult.Failed).status)
            assertEquals(404, (store.keepWebPlus() as MutationResult.Failed).status)
            assertTrue(sessions.state.value is SessionState.SignedIn)
        }

    @Test
    fun aCancellationConflictRereadsTheWebsiteState() =
        runTest {
            val (_, store) = store(ana)
            api.websiteRead = { StripeSubscriptionCancellation(ENDS, State.RENEWING) }
            val shown = launch { store.websiteSubscription.shown.collect {} }
            advanceUntilIdle()

            api.cancelFailure = ApiException(ApiError.Unavailable, "CONFLICT", 409)
            api.websiteRead = { StripeSubscriptionCancellation(ENDS, State.ENDING) }
            val result = store.cancelWebPlus()
            advanceUntilIdle()

            assertEquals(409, (result as MutationResult.Failed).status)
            assertTrue(api.canceled.isEmpty())
            assertEquals(
                State.ENDING,
                store.websiteSubscription.state.value.value
                    ?.state,
            )
            assertEquals(2, api.websiteReads)
            shown.cancel()
        }

    @Test
    fun keepingPlusRereadsTheWebsiteStateWithTheSessionsToken() =
        runTest {
            val (_, store) = store(ana)
            api.websiteRead = { StripeSubscriptionCancellation(ENDS, State.ENDING) }
            val shown = launch { store.websiteSubscription.shown.collect {} }
            advanceUntilIdle()

            api.websiteRead = { StripeSubscriptionCancellation(ENDS, State.RENEWING) }
            val result = store.keepWebPlus()
            advanceUntilIdle()

            assertEquals(MutationResult.Done(Unit), result)
            assertEquals(listOf("token-a"), api.kept)
            assertEquals(
                State.RENEWING,
                store.websiteSubscription.state.value.value
                    ?.state,
            )
            assertEquals(2, api.websiteReads)
            shown.cancel()
        }

    @Test
    fun aKeepConflictRereadsTheWebsiteState() =
        runTest {
            val (_, store) = store(ana)
            api.websiteRead = { StripeSubscriptionCancellation(ENDS, State.ENDING) }
            val shown = launch { store.websiteSubscription.shown.collect {} }
            advanceUntilIdle()

            api.keepAnswer = { throw ApiException(ApiError.Unavailable, "CONFLICT", 409) }
            api.websiteRead = { StripeSubscriptionCancellation(null, State.UNPAID) }
            val result = store.keepWebPlus()
            advanceUntilIdle()

            assertEquals(409, (result as MutationResult.Failed).status)
            assertEquals(
                State.UNPAID,
                store.websiteSubscription.state.value.value
                    ?.state,
            )
            assertEquals(2, api.websiteReads)
            shown.cancel()
        }

    @Test
    fun aCancellationWaitsForItsUpdatedWebsiteState() = runTest { waitForWebsiteRefresh(cancel = true, conflict = false) }

    @Test
    fun keepingPlusWaitsForItsUpdatedWebsiteState() = runTest { waitForWebsiteRefresh(cancel = false, conflict = false) }

    @Test
    fun aCancellationConflictWaitsForItsUpdatedWebsiteState() = runTest { waitForWebsiteRefresh(cancel = true, conflict = true) }

    @Test
    fun aKeepConflictWaitsForItsUpdatedWebsiteState() = runTest { waitForWebsiteRefresh(cancel = false, conflict = true) }

    private suspend fun TestScope.waitForWebsiteRefresh(
        cancel: Boolean,
        conflict: Boolean,
    ) {
        val (_, store) = store(ana)
        val before = if (cancel) State.RENEWING else State.ENDING
        val after = if (cancel) State.ENDING else State.RENEWING
        api.websiteRead = { StripeSubscriptionCancellation(ENDS, before) }
        val shown = launch { store.websiteSubscription.shown.collect {} }
        advanceUntilIdle()

        val refreshed = CompletableDeferred<StripeSubscriptionCancellation>()
        api.websiteRead = { refreshed.await() }
        if (conflict) {
            if (cancel) {
                api.cancelFailure = ApiException(ApiError.Unavailable, "CONFLICT", 409)
            } else {
                api.keepAnswer = { throw ApiException(ApiError.Unavailable, "CONFLICT", 409) }
            }
        }
        val mutation = async { if (cancel) store.cancelWebPlus() else store.keepWebPlus() }
        advanceUntilIdle()

        assertEquals(
            before,
            store.websiteSubscription.state.value.value
                ?.state,
        )
        assertEquals(2, api.websiteReads)
        assertFalse("The action must stay pending until its refreshed state arrives", mutation.isCompleted)

        refreshed.complete(StripeSubscriptionCancellation(ENDS, after))
        advanceUntilIdle()
        assertTrue(mutation.isCompleted)
        if (conflict) {
            assertEquals(409, (mutation.await() as MutationResult.Failed).status)
        } else {
            assertTrue(mutation.await() is MutationResult.Done)
        }
        assertEquals(
            after,
            store.websiteSubscription.state.value.value
                ?.state,
        )
        assertEquals(2, api.websiteReads)
        shown.cancel()
    }

    @Test
    fun aGuestHasNoWebsitePlanAndKeepsItsSession() =
        runTest {
            val (sessions, store) = store(AuthenticatedSession(GUEST, "token-guest", "local-g"), isGuest = true)

            store.websiteSubscription.load()
            store.websiteSubscription.load()

            assertEquals(LoadState.Empty, store.websiteSubscription.state.value)
            assertTrue(sessions.state.value is SessionState.SignedIn)
            assertEquals(1, api.websiteReads)
        }

    @Test
    fun anExpiredSessionIsSignedOut() =
        runTest {
            val (sessions, store) = store(ana)
            api.websiteRead = { throw ApiException(ApiError.Unauthorized, status = 401) }

            store.websiteSubscription.load()
            advanceUntilIdle()

            assertTrue(sessions.state.value is SessionState.SignedOut)
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
}
