package com.zoonk.android.feature.subscription

import android.app.Activity
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.perform
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.GooglePlaySubscriptionRequest
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.StoreSubscriptionResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException

interface SubscriptionApi {
    suspend fun account(session: AuthenticatedSession): MeResponse

    suspend fun allowance(session: AuthenticatedSession): AllowanceResponse

    suspend fun linkGooglePlay(
        session: AuthenticatedSession,
        purchaseToken: String,
    ): StoreSubscriptionResponse
}

class LiveSubscriptionApi(
    private val api: ApiClients,
) : SubscriptionApi {
    override suspend fun account(session: AuthenticatedSession): MeResponse = perform { api.clients(session).account.getCurrentUser() }

    override suspend fun allowance(session: AuthenticatedSession): AllowanceResponse =
        perform {
            api.clients(session).account.getCurrentUserAllowance()
        }

    override suspend fun linkGooglePlay(
        session: AuthenticatedSession,
        purchaseToken: String,
    ): StoreSubscriptionResponse =
        perform { api.clients(session).subscriptions.createGooglePlaySubscription(GooglePlaySubscriptionRequest(purchaseToken)) }
}

sealed interface PurchaseState {
    data object Idle : PurchaseState

    /** Play's sheet is open. */
    data object Buying : PurchaseState

    data object Pending : PurchaseState

    /** Zoonk is checking the purchase with Google. */
    data object Confirming : PurchaseState

    data object Done : PurchaseState

    /** The Play purchase belongs to another Zoonk account. */
    data object OtherAccount : PurchaseState

    /** Play couldn't open or finish the purchase. */
    data object PlayFailed : PurchaseState

    /** Paid on Play, but Zoonk couldn't confirm it yet; it's tried again when the app returns. */
    data object ConfirmFailed : PurchaseState
}

/**
 * Plus on Google Play: Play's prices, the purchase, and linking every purchase to the account
 * that made it. Google refunds a purchase nobody acknowledges within three days, and the server
 * acknowledges it once linked, so unlinked purchases are linked again whenever a full account is
 * in the foreground. A guest never links one: the server would make the purchase the guest's.
 */
class SubscriptionStore(
    private val api: SubscriptionApi,
    private val billing: PlayBilling,
    private val sessions: SessionStore,
    private val cache: AppCache,
    scope: CoroutineScope,
    isForeground: Flow<Boolean>,
) {
    val offers: Resource<PlusOffers> = cache.resource(Audience.Everyone) { billing.offers() }

    /** The account with its subscription, which the summary doesn't carry. */
    val account: Resource<MeResponse> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.UserSession, DataDomain.UserSubscription)) { session ->
            session?.let { api.account(it) }
        }

    val allowance: Resource<AllowanceResponse> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Allowance)) { session -> session?.let { api.allowance(it) } }

    private val mutablePurchase = MutableStateFlow<PurchaseState>(PurchaseState.Idle)
    val purchase: StateFlow<PurchaseState> = mutablePurchase.asStateFlow()

    private val linking = mutableSetOf<String>()

    init {
        scope.launch {
            billing.updates.collect { update ->
                when (update) {
                    is PlayPurchaseUpdate.Purchased -> fullAccount()?.let { link(it, update.purchaseToken) }
                    PlayPurchaseUpdate.Pending -> mutablePurchase.value = PurchaseState.Pending
                    PlayPurchaseUpdate.Canceled -> mutablePurchase.value = PurchaseState.Idle
                    PlayPurchaseUpdate.Failed -> mutablePurchase.value = PurchaseState.PlayFailed
                }
            }
        }
        // Each account starts clean, and links what Play holds once it's in the foreground.
        scope.launch {
            combine(isForeground, sessions.state) { foreground, _ -> fullAccount() to foreground }
                .distinctUntilChanged()
                // A newer account or foreground cancels the last one's relinking rather than waiting on it.
                .collectLatest { (session, foreground) ->
                    if (session != reconciledFor) mutablePurchase.value = PurchaseState.Idle
                    reconciledFor = session
                    if (session != null && foreground) reconcile(session)
                }
        }
    }

    private var reconciledFor: AuthenticatedSession? = null

    /** Only an account can buy: a guest creates one first, as main asks. */
    suspend fun buy(
        activity: Activity,
        period: BillingPeriod,
    ) {
        val session = fullAccount() ?: return
        if (mutablePurchase.value == PurchaseState.Buying || mutablePurchase.value == PurchaseState.Confirming) return
        mutablePurchase.value = PurchaseState.Buying
        try {
            // Play's details go stale; a checkout always starts from fresh ones.
            val offers = billing.offers()
            if (offers != null) this.offers.replace(offers)
            val offer = offers?.let { it.offerFor(period) ?: it.monthly ?: it.yearly }
            if (fullAccount() != session) return
            val opened = offers != null && offer != null && billing.buy(activity, offers, offer, session.accountId)
            if (!opened && fullAccount() == session) mutablePurchase.value = PurchaseState.PlayFailed
        } catch (e: CancellationException) {
            if (fullAccount() == session && mutablePurchase.value == PurchaseState.Buying) mutablePurchase.value = PurchaseState.Idle
            throw e
        }
    }

    /** Play's answer to a purchase can be lost; whatever is still unlinked is found here. */
    private suspend fun reconcile(session: AuthenticatedSession) {
        if (mutablePurchase.value == PurchaseState.Buying) mutablePurchase.value = PurchaseState.Idle
        billing.unacknowledgedPurchases().forEach { link(session, it) }
    }

    private suspend fun link(
        session: AuthenticatedSession,
        purchaseToken: String,
    ) {
        if (sessions.current != session || !linking.add(purchaseToken)) return
        mutablePurchase.value = PurchaseState.Confirming
        try {
            val result =
                cache.mutate(
                    invalidating = setOf(DataDomain.UserSubscription, DataDomain.Allowance, DataDomain.UserSession),
                    replacing = { listOf(account.replacing(it.currentAccount)) },
                ) { current -> api.linkGooglePlay(current, purchaseToken) }
            // Linked or not, a state for a session that ended belongs to nobody on screen.
            if (fullAccount() != session) return
            when (result) {
                is MutationResult.Done -> {
                    sessions.showAccount(session, result.value.currentAccount)
                    mutablePurchase.value = PurchaseState.Done
                }

                is MutationResult.Failed -> {
                    mutablePurchase.value =
                        if (result.code in OTHER_ACCOUNT_CODES) PurchaseState.OtherAccount else PurchaseState.ConfirmFailed
                }

                MutationResult.Obsolete -> {}
            }
        } finally {
            linking.remove(purchaseToken)
        }
    }

    private fun fullAccount(): AuthenticatedSession? = (sessions.state.value as? SessionState.SignedIn)?.takeUnless { it.isGuest }?.session

    private companion object {
        val OTHER_ACCOUNT_CODES = setOf("GOOGLE_PLAY_ACCOUNT_MISMATCH", "GOOGLE_PLAY_SUBSCRIPTION_CONFLICT")
    }
}

fun PlusOffers.offerFor(period: BillingPeriod): PlusOffer? = if (period == BillingPeriod.Yearly) yearly else monthly
