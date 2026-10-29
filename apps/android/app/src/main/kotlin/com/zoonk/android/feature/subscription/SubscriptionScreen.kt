package com.zoonk.android.feature.subscription

import androidx.activity.compose.LocalActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.MeSubscription
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

/**
 * Main's subscription page: a subscriber sees their plan and where to manage it; anyone else sees
 * Plus with Play's prices. Only an account subscribes; a guest or visitor logs in first.
 */
@Composable
fun SubscriptionScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.takeUnless { it.isGuest }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.account_menu_subscription)) }) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                if (signedIn == null) {
                    Offer(app, navigator, hasAccount = false)
                } else {
                    Account(app, navigator)
                }
            }
        }
    }
}

@Composable
private fun Account(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val account by app.subscriptions.account.collectShown()
    val scope = rememberCoroutineScope()

    when (val state = account) {
        is LoadState.Loaded -> {
            val subscription = state.value.account.subscription
            if (subscription != null) CurrentPlan(subscription, navigator) else Offer(app, navigator, hasAccount = true)
        }

        is LoadState.Failed -> {
            LoadFailedMessage(onRetry = { scope.launch { app.subscriptions.account.refresh() } })
        }

        LoadState.Idle, LoadState.Loading, LoadState.Empty -> {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        }
    }
}

@Composable
private fun CurrentPlan(
    subscription: MeSubscription,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val isEnding = subscription.cancelAt != null
    val provider = subscription.provider

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(R.string.subscription_plus),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
            LabelChip(stringResource(if (isEnding) R.string.subscription_ending else R.string.subscription_active))
        }
        dateLine(subscription)?.let {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }

    PlusBenefits()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text =
                stringResource(
                    when (provider) {
                        GOOGLE -> R.string.subscription_managed_google
                        APPLE -> R.string.subscription_managed_apple
                        STRIPE -> R.string.subscription_managed_web
                        else -> R.string.subscription_managed_zoonk
                    },
                ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            when (provider) {
                GOOGLE -> {
                    Button(
                        onClick = {
                            val url =
                                "https://play.google.com/store/account/subscriptions?sku=$PLUS_PRODUCT_ID&package=${context.packageName}"
                            CustomTabsIntent.Builder().build().launchUrl(context, url.toUri())
                        },
                    ) { Text(stringResource(R.string.subscription_manage_google)) }
                }

                STRIPE -> {
                    Button(onClick = { navigator.open(AppRoute.WebSubscription) }) {
                        Text(stringResource(R.string.subscription_manage_web))
                    }
                }
            }
            OutlinedButton(
                onClick = { navigator.open(AppRoute.Help) },
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
            ) { Text(stringResource(R.string.subscription_contact_support)) }
        }
    }
}

@Composable
private fun dateLine(subscription: MeSubscription): String? {
    val locale = currentLocale()
    val format = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale)

    fun date(instant: kotlin.time.Instant) =
        format.format(
            java.time.Instant
                .ofEpochMilli(instant.toEpochMilliseconds())
                .atZone(ZoneId.systemDefault()),
        )

    val cancelAt = subscription.cancelAt
    val periodEnd = subscription.periodEnd
    return when {
        cancelAt != null -> stringResource(R.string.subscription_ends_on, date(cancelAt))
        periodEnd == null -> null
        subscription.provider == STRIPE -> stringResource(R.string.subscription_renews_on, date(periodEnd))
        else -> stringResource(R.string.subscription_period_ends_on, date(periodEnd))
    }
}

@Composable
private fun Offer(
    app: AppContainer,
    navigator: AppNavigator,
    hasAccount: Boolean,
) {
    val offers by app.subscriptions.offers.collectShown()
    val purchase by app.subscriptions.purchase.collectAsStateWithLifecycle()
    var period by rememberSaveable { mutableStateOf(BillingPeriod.Monthly) }
    val activity = LocalActivity.current
    val scope = rememberCoroutineScope()
    val plans = offers.value
    // Play can sell one base plan and not the other in a region: show the one it sells.
    val offer = plans?.let { it.offerFor(period) ?: it.monthly ?: it.yearly }
    val isWorking = purchase == PurchaseState.Buying || purchase == PurchaseState.Confirming
    val canBuy = offer != null || offers is LoadState.Loading

    Text(
        stringResource(R.string.subscription_offer_title),
        Modifier.semantics { heading() },
        style = MaterialTheme.typography.headlineSmall,
    )

    if (hasAccount) FreePlanSummary(app)

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.subscription_plus), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)

            if (plans?.monthly != null && plans.yearly != null) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    BillingPeriod.entries.forEachIndexed { index, choice ->
                        SegmentedButton(
                            selected = period == choice,
                            onClick = { period = choice },
                            shape = SegmentedButtonDefaults.itemShape(index, BillingPeriod.entries.size),
                        ) {
                            if (choice == BillingPeriod.Monthly) {
                                Text(stringResource(R.string.subscription_monthly))
                            } else {
                                YearlyLabel(plans.yearlySavings())
                            }
                        }
                    }
                }
            }

            when {
                offer != null -> Price(offer)
                offers is LoadState.Loading -> CircularProgressIndicator(Modifier.size(24.dp).align(Alignment.CenterHorizontally))
                else -> Note(stringResource(R.string.subscription_unavailable))
            }

            when {
                !canBuy -> {}

                !hasAccount -> {
                    Button(onClick = { navigator.open(AppRoute.Login) }, modifier = Modifier.fillMaxWidth()) {
                        Text(stringResource(R.string.subscription_get_plus))
                    }
                }

                else -> {
                    Button(
                        onClick = { activity?.let { scope.launch { offer?.let { chosen -> app.subscriptions.buy(it, chosen.period) } } } },
                        enabled = offer != null && !isWorking && activity != null,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(stringResource(R.string.subscription_subscribe))
                        if (isWorking) {
                            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                            CircularProgressIndicator(
                                Modifier.size(ButtonDefaults.IconSize),
                                color = LocalContentColor.current,
                                strokeWidth = 2.dp,
                            )
                        }
                    }
                }
            }
            if (canBuy) Note(stringResource(R.string.subscription_cancel_anytime), Modifier.align(Alignment.CenterHorizontally))
            PurchaseMessage(purchase)
            if (purchase == PurchaseState.ConfirmFailed) {
                OutlinedButton(
                    onClick = { navigator.open(AppRoute.Help) },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
                ) { Text(stringResource(R.string.subscription_contact_support)) }
            }
            PlusBenefits()
        }
    }
}

@Composable
private fun Price(offer: PlusOffer) {
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(offer.formattedPrice, style = MaterialTheme.typography.headlineMedium)
            Text(
                text =
                    stringResource(
                        if (offer.period ==
                            BillingPeriod.Monthly
                        ) {
                            R.string.subscription_per_month
                        } else {
                            R.string.subscription_per_year
                        },
                    ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (offer.period == BillingPeriod.Monthly) {
            Note(stringResource(R.string.subscription_billed_monthly))
        } else {
            Note(stringResource(R.string.subscription_yearly_per_month, money(offer.priceMicros / 12, offer.currency, locale)))
        }
    }
}

/** Main's Yearly segment, which names the savings before the learner switches to it. */
@Composable
private fun YearlyLabel(savings: PlusOffer?) {
    val yearly = stringResource(R.string.subscription_yearly)
    if (savings == null) return Text(yearly)
    val save = stringResource(R.string.subscription_save, money(savings.priceMicros, savings.currency, currentLocale()))
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Text(
        buildAnnotatedString {
            append(yearly)
            append(" ")
            withStyle(SpanStyle(color = muted)) { append(save) }
        },
    )
}

/** What a year costs less than twelve months, as an offer in the yearly plan's currency; null when it doesn't. */
private fun PlusOffers.yearlySavings(): PlusOffer? {
    val monthly = monthly ?: return null
    val yearly = yearly ?: return null
    val savings = monthly.priceMicros * 12 - yearly.priceMicros
    return yearly.takeIf { monthly.currency == it.currency && savings > 0 }?.copy(priceMicros = savings)
}

@Composable
private fun PurchaseMessage(purchase: PurchaseState) {
    val message =
        when (purchase) {
            PurchaseState.Pending -> R.string.subscription_purchase_pending
            PurchaseState.Confirming -> R.string.subscription_purchase_confirming
            PurchaseState.OtherAccount -> R.string.subscription_purchase_other_account
            PurchaseState.PlayFailed -> R.string.subscription_purchase_play_failed
            PurchaseState.ConfirmFailed -> R.string.subscription_purchase_confirm_failed
            PurchaseState.Idle, PurchaseState.Buying, PurchaseState.Done -> return
        }
    val isProblem =
        purchase == PurchaseState.OtherAccount || purchase == PurchaseState.PlayFailed || purchase == PurchaseState.ConfirmFailed
    Text(
        text = stringResource(message),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (isProblem) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Main's "Your plan" on Free: the buddy messages used today. */
@Composable
private fun FreePlanSummary(app: AppContainer) {
    val allowance by app.subscriptions.allowance.collectShown()
    val messages = allowance.value?.items?.firstOrNull { it.kind == AllowanceItem.Kind.TUTOR_MESSAGE }
    val limit = messages?.dailyLimit

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.subscription_your_plan))
        OutlinedCard(Modifier.fillMaxWidth()) {
            ListItem(
                headlineContent = { Text(stringResource(R.string.subscription_free)) },
                supportingContent =
                    if (messages != null && limit != null) {
                        {
                            Text(
                                pluralStringResource(
                                    R.plurals.subscription_messages_used,
                                    limit.toInt(),
                                    messages.usedToday.toInt(),
                                    limit.toInt(),
                                ),
                            )
                        }
                    } else {
                        null
                    },
            )
        }
    }
}

/** Main's PlusBenefits. */
@Composable
fun PlusBenefits(modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.subscription_benefits_summary), style = MaterialTheme.typography.titleMedium)
        listOf(
            R.string.subscription_benefit_exam,
            R.string.subscription_benefit_mocks,
            R.string.subscription_benefit_buddy,
            R.string.subscription_benefit_calls,
        ).forEach { benefit ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                Icon(
                    painterResource(R.drawable.ic_check),
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(stringResource(benefit), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun Note(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

private fun money(
    micros: Long,
    currency: String,
    locale: Locale,
): String =
    NumberFormat
        .getCurrencyInstance(locale)
        .apply { this.currency = Currency.getInstance(currency) }
        .format(micros / 1_000_000.0)

private const val GOOGLE = "google"
private const val APPLE = "apple"
private const val STRIPE = "stripe"
