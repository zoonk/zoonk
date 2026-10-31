package com.zoonk.android.feature.subscription

import android.app.Activity
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
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
import com.zoonk.api.models.FreePlan
import com.zoonk.api.models.GooglePlaySubscriptionRequest
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.StoreSubscriptionResponse
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import com.zoonk.api.models.StripeSubscriptionCancellationRequest
import com.zoonk.api.models.StripeSubscriptionCancellationRequest.Choice
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

    suspend fun freePlan(): FreePlan

    suspend fun linkGooglePlay(
        session: AuthenticatedSession,
        purchaseToken: String,
    ): StoreSubscriptionResponse

    suspend fun webPlusCancellation(session: AuthenticatedSession): StripeSubscriptionCancellation

    suspend fun cancelWebPlus(
        session: AuthenticatedSession,
        choice: Choice,
    ): StripeSubscriptionCancellationReceipt

    suspend fun keepWebPlus(session: AuthenticatedSession)
}

class LiveSubscriptionApi(
    private val api: ApiClients,
) : SubscriptionApi {
    override suspend fun account(session: AuthenticatedSession): MeResponse = perform { api.clients(session).account.getCurrentUser() }

    override suspend fun allowance(session: AuthenticatedSession): AllowanceResponse =
        perform {
            api.clients(session).account.getCurrentUserAllowance()
        }

    override suspend fun freePlan(): FreePlan = perform { api.clients(null).subscriptions.getFreePlan() }

    override suspend fun linkGooglePlay(
        session: AuthenticatedSession,
        purchaseToken: String,
    ): StoreSubscriptionResponse =
        perform { api.clients(session).subscriptions.createGooglePlaySubscription(GooglePlaySubscriptionRequest(purchaseToken)) }

    override suspend fun webPlusCancellation(session: AuthenticatedSession): StripeSubscriptionCancellation =
        perform { api.clients(session).subscriptions.getStripeSubscriptionCancellation() }

    override suspend fun cancelWebPlus(
        session: AuthenticatedSession,
        choice: Choice,
    ): StripeSubscriptionCancellationReceipt =
        perform { api.clients(session).subscriptions.cancelStripeSubscription(StripeSubscriptionCancellationRequest(choice)) }

    override suspend fun keepWebPlus(session: AuthenticatedSession) =
        perform { api.clients(session).subscriptions.resumeStripeSubscription() }
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

    val freePlan: Resource<FreePlan> = cache.resource(Audience.Everyone) { api.freePlan() }

    /**
     * What canceling, keeping Plus or deleting the account does to a Plus bought on the web. It asks
     * Stripe, so only a screen showing such a Plus collects it.
     */
    val webPlusChoices: Resource<StripeSubscriptionCancellation> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.UserSubscription)) { session ->
            session?.let { api.webPlusCancellation(it) }
        }

    val allowance: Resource<AllowanceResponse> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Allowance, DataDomain.Goals, DataDomain.UserSubscription)) { session ->
            session?.let { api.allowance(it) }
        }

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

    /**
     * What canceling a Plus bought on the web would do, read only from the learner's tap. `NotFound`
     * means it changed elsewhere and nothing is left to cancel, so the plan is read again.
     */
    suspend fun webPlusCancellation(): MutationResult<StripeSubscriptionCancellation> =
        cache
            .mutate { api.webPlusCancellation(it) }
            .also { if (it is MutationResult.Failed && it.error == ApiError.NotFound) readPlanAgain() }

    /** A 409 means the chosen option closed meanwhile, so the plan is read again. */
    suspend fun cancelWebPlus(choice: Choice): MutationResult<StripeSubscriptionCancellationReceipt> =
        cache
            .mutate(invalidating = SUBSCRIPTION_DOMAINS) { api.cancelWebPlus(it, choice) }
            .also { if (it is MutationResult.Failed && it.status == HTTP_CONFLICT) readPlanAgain() }

    /**
     * Turns a stopped renewal back on. The answer carries no plan, so the plan shows renewing at once, unless
     * a different one was read meanwhile, and is then read again. A 409 means only the renewal isn't stopped
     * anymore, so the plan is read again.
     */
    suspend fun keepWebPlus(): MutationResult<Unit> {
        val planToKeep = shownPlan()
        return cache
            .mutate(invalidating = SUBSCRIPTION_DOMAINS) { api.keepWebPlus(it) }
            .also {
                if (it is MutationResult.Done && shownPlan() == planToKeep) account.update(MeResponse::renewing)
                if (it is MutationResult.Failed && it.status == HTTP_CONFLICT) readPlanAgain()
            }
    }

    private fun shownPlan() =
        account.state.value.value
            ?.account
            ?.subscription

    private fun readPlanAgain() = cache.invalidate(SUBSCRIPTION_DOMAINS)

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
                    invalidating = SUBSCRIPTION_DOMAINS,
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
        val SUBSCRIPTION_DOMAINS = setOf(DataDomain.UserSubscription, DataDomain.Allowance, DataDomain.UserSession)
    }
}

private fun MeResponse.renewing() =
    copy(account = account.copy(subscription = account.subscription?.copy(cancelAt = null, cancelAtPeriodEnd = false)))

fun PlusOffers.offerFor(period: BillingPeriod): PlusOffer? = if (period == BillingPeriod.Yearly) yearly else monthly

/** The web Plus answer when the chosen option, or keeping Plus, closed meanwhile. */
internal const val HTTP_CONFLICT = 409
