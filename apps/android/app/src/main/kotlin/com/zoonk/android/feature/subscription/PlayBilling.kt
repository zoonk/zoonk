package com.zoonk.android.feature.subscription

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume

enum class BillingPeriod { Monthly, Yearly }

/** One base plan of the `plus` product, as Play prices it for this learner. */
data class PlusOffer(
    val period: BillingPeriod,
    val offerToken: String,
    val formattedPrice: String,
    val priceMicros: Long,
    val currency: String,
)

/** [product] is Play's own product, which a purchase needs back. */
class PlusOffers(
    val monthly: PlusOffer?,
    val yearly: PlusOffer?,
    internal val product: Any,
)

sealed interface PlayPurchaseUpdate {
    data class Purchased(
        val purchaseToken: String,
    ) : PlayPurchaseUpdate

    /** Paid with a method that settles later; Play tells again once it does. */
    data object Pending : PlayPurchaseUpdate

    data object Canceled : PlayPurchaseUpdate

    data object Failed : PlayPurchaseUpdate
}

/** Google Play Billing, behind what the subscription store needs, so its logic runs on the JVM. */
interface PlayBilling {
    /** Null when Play can't sell Plus here: no Play Store, or the product isn't set up. */
    suspend fun offers(): PlusOffers?

    /** False when Play's sheet couldn't open; its answer comes through [updates]. */
    suspend fun buy(
        activity: Activity,
        offers: PlusOffers,
        offer: PlusOffer,
        accountId: String,
    ): Boolean

    val updates: Flow<PlayPurchaseUpdate>

    /** Bought but not linked to a Zoonk account yet: in another session, the Play Store or with a promo code. */
    suspend fun unacknowledgedPurchases(): List<String>
}

class GooglePlayBilling(
    context: Context,
) : PlayBilling {
    private val mutableUpdates =
        MutableSharedFlow<PlayPurchaseUpdate>(extraBufferCapacity = 8, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val updates: Flow<PlayPurchaseUpdate> = mutableUpdates

    private val client =
        BillingClient
            .newBuilder(context.applicationContext)
            .setListener { result, purchases -> mutableUpdates.tryEmit(update(result, purchases)) }
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()

    private val connecting = Mutex()

    override suspend fun offers(): PlusOffers? {
        if (!connect()) return null
        val params =
            QueryProductDetailsParams
                .newBuilder()
                .setProductList(
                    listOf(
                        QueryProductDetailsParams.Product
                            .newBuilder()
                            .setProductId(PRODUCT_ID)
                            .setProductType(BillingClient.ProductType.SUBS)
                            .build(),
                    ),
                ).build()
        val product = client.queryProductDetails(params).productDetailsList?.firstOrNull() ?: return null
        val offers = product.subscriptionOfferDetails.orEmpty().filter { it.offerId == null }

        fun offer(period: BillingPeriod) =
            offers.firstOrNull { it.basePlanId == period.basePlanId }?.let { details ->
                val phase = details.pricingPhases.pricingPhaseList.last()
                PlusOffer(period, details.offerToken, phase.formattedPrice, phase.priceAmountMicros, phase.priceCurrencyCode)
            }

        return PlusOffers(offer(BillingPeriod.Monthly), offer(BillingPeriod.Yearly), product)
    }

    override suspend fun buy(
        activity: Activity,
        offers: PlusOffers,
        offer: PlusOffer,
        accountId: String,
    ): Boolean {
        if (!connect()) return false
        val params =
            BillingFlowParams
                .newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams
                            .newBuilder()
                            .setProductDetails(offers.product as ProductDetails)
                            .setOfferToken(offer.offerToken)
                            .build(),
                    ),
                )
                // The server links the purchase to this account and refuses another account's.
                .setObfuscatedAccountId(accountId)
                .build()
        return client.launchBillingFlow(activity, params).responseCode == BillingClient.BillingResponseCode.OK
    }

    override suspend fun unacknowledgedPurchases(): List<String> {
        if (!connect()) return emptyList()
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        return client
            .queryPurchasesAsync(params)
            .purchasesList
            .filter { it.purchaseState == Purchase.PurchaseState.PURCHASED && !it.isAcknowledged }
            .map { it.purchaseToken }
    }

    private suspend fun connect(): Boolean =
        connecting.withLock {
            if (client.isReady) return@withLock true
            suspendCancellableCoroutine { continuation ->
                client.startConnection(
                    object : BillingClientStateListener {
                        override fun onBillingSetupFinished(result: BillingResult) {
                            if (continuation.isActive) continuation.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                        }

                        override fun onBillingServiceDisconnected() {
                            if (continuation.isActive) continuation.resume(false)
                        }
                    },
                )
            }
        }

    private fun update(
        result: BillingResult,
        purchases: List<Purchase>?,
    ): PlayPurchaseUpdate {
        val purchase = purchases?.firstOrNull()
        return when {
            result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED -> PlayPurchaseUpdate.Canceled
            result.responseCode != BillingClient.BillingResponseCode.OK || purchase == null -> PlayPurchaseUpdate.Failed
            purchase.purchaseState == Purchase.PurchaseState.PENDING -> PlayPurchaseUpdate.Pending
            else -> PlayPurchaseUpdate.Purchased(purchase.purchaseToken)
        }
    }

    private companion object {
        const val PRODUCT_ID = "plus"
    }
}

/** The base plans set up in Play Console under the `plus` product. */
val BillingPeriod.basePlanId: String
    get() =
        when (this) {
            BillingPeriod.Monthly -> "monthly"
            BillingPeriod.Yearly -> "yearly"
        }
