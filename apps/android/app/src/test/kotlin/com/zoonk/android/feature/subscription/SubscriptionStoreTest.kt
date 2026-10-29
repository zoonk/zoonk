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
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.account
import com.zoonk.android.data.value
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.StoreSubscriptionResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import java.util.UUID

private fun subscribed(id: String): MeResponse =
    account(id).let {
        val subscription =
            MeSubscription(
                cancelAt = null,
                cancelAtPeriodEnd = false,
                id = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0d4"),
                periodEnd = null,
                periodStart = null,
                plan = "plus",
                provider = "google",
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

    override suspend fun account(session: AuthenticatedSession): MeResponse = account(session.accountId)

    override suspend fun allowance(session: AuthenticatedSession): AllowanceResponse = throw UnsupportedOperationException()

    override suspend fun linkGooglePlay(
        session: AuthenticatedSession,
        purchaseToken: String,
    ): StoreSubscriptionResponse {
        failure?.let { throw it }
        linked += session.bearerToken to purchaseToken
        return StoreSubscriptionResponse(subscribed(session.accountId), isActive = true)
    }
}

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
