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
import com.zoonk.android.data.value
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.GooglePlaySubscriptionRequest
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.StoreSubscriptionResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
 * acknowledges it once linked, so unlinked purchases are linked again each time the app returns.
 */
class SubscriptionStore(
    private val api: SubscriptionApi,
    private val billing: PlayBilling,
    private val sessions: SessionStore,
    private val cache: AppCache,
    scope: CoroutineScope,
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

    init {
        scope.launch {
            billing.updates.collect { update ->
                when (update) {
                    is PlayPurchaseUpdate.Purchased -> link(update.purchaseToken)
                    PlayPurchaseUpdate.Pending -> mutablePurchase.value = PurchaseState.Pending
                    PlayPurchaseUpdate.Canceled -> mutablePurchase.value = PurchaseState.Idle
                    PlayPurchaseUpdate.Failed -> mutablePurchase.value = PurchaseState.PlayFailed
                }
            }
        }
    }

    /** Only an account can buy: a guest creates one first, as main asks. */
    suspend fun buy(
        activity: Activity,
        period: BillingPeriod,
    ) {
        val signedIn = sessions.state.value as? SessionState.SignedIn ?: return
        if (signedIn.isGuest || mutablePurchase.value == PurchaseState.Buying || mutablePurchase.value == PurchaseState.Confirming) return
        val offers = offers.state.value.value ?: return
        val offer = (if (period == BillingPeriod.Yearly) offers.yearly else offers.monthly) ?: return
        mutablePurchase.value = PurchaseState.Buying
        val opened =
            try {
                billing.buy(activity, offers, offer, signedIn.session.accountId)
            } catch (e: CancellationException) {
                mutablePurchase.value = PurchaseState.Idle
                throw e
            }
        if (!opened) mutablePurchase.value = PurchaseState.PlayFailed
    }

    /** When the app returns: links purchases made elsewhere or whose confirmation failed. */
    suspend fun linkUnlinkedPurchases() {
        val signedIn = sessions.state.value as? SessionState.SignedIn ?: return
        if (signedIn.isGuest) return
        billing.unacknowledgedPurchases().forEach { link(it) }
    }

    private suspend fun link(purchaseToken: String) {
        mutablePurchase.value = PurchaseState.Confirming
        var linkedBy: AuthenticatedSession? = null
        val result =
            cache.mutate(
                invalidating = setOf(DataDomain.UserSubscription, DataDomain.Allowance, DataDomain.UserSession),
                replacing = { listOf(account.replacing(it.currentAccount)) },
            ) { session ->
                linkedBy = session
                api.linkGooglePlay(session, purchaseToken)
            }
        mutablePurchase.value =
            when (result) {
                is MutationResult.Done -> {
                    linkedBy?.let { sessions.showAccount(it, result.value.currentAccount) }
                    PurchaseState.Done
                }

                is MutationResult.Failed -> {
                    if (result.code in OTHER_ACCOUNT_CODES) PurchaseState.OtherAccount else PurchaseState.ConfirmFailed
                }

                MutationResult.Obsolete -> {
                    PurchaseState.Idle
                }
            }
    }

    fun dismissPurchaseState() {
        if (mutablePurchase.value != PurchaseState.Buying && mutablePurchase.value != PurchaseState.Confirming) {
            mutablePurchase.value = PurchaseState.Idle
        }
    }

    private companion object {
        val OTHER_ACCOUNT_CODES = setOf("GOOGLE_PLAY_ACCOUNT_MISMATCH", "GOOGLE_PLAY_SUBSCRIPTION_CONFLICT")
    }
}
