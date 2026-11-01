package com.zoonk.android.feature.subscription

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.openWebPage
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.FreePlan
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellation.State
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale
import kotlin.time.Instant

/**
 * Main's subscription page: a subscriber sees their plan and where to manage it; anyone else sees
 * Plus with Play's prices beside Free. Only an account subscribes; a guest or visitor logs in first.
 */
@Composable
fun SubscriptionScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.account_menu_subscription)) }) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            contentAlignment = Alignment.TopCenter,
        ) {
            when (val state = session) {
                is SessionState.SignedIn -> {
                    if (state.isGuest) Offer(app, navigator, PlanViewer.Guest) else Account(app, navigator, state.session.localId)
                }

                is SessionState.SignedOut -> {
                    Offer(app, navigator, PlanViewer.Visitor)
                }

                SessionState.Restoring -> {
                    CircularProgressIndicator()
                }

                SessionState.Unavailable -> {
                    LoadFailedMessage(onRetry = { scope.launch { app.sessions.retryRestore() } })
                }
            }
        }
    }
}

/** Who reads Plus's offer, as main's viewer states; a subscriber sees their plan instead. */
internal enum class PlanViewer { Visitor, Guest, Free }

@Composable
private fun Account(
    app: AppContainer,
    navigator: AppNavigator,
    sessionKey: String,
) {
    val account by app.subscriptions.account.collectShown()
    val purchase by app.subscriptions.purchase.collectAsStateWithLifecycle()
    val website by app.subscriptions.websiteSubscription.collectShown()
    val scope = rememberCoroutineScope()
    val cancellation =
        viewModel(key = "web-plus-cancellation:$sessionKey") {
            WebPlusCancellationViewModel(
                app.subscriptions::cancelWebPlus,
                app.subscriptions::keepWebPlus,
            )
        }

    WebPlusCancellationDialog(cancellation)

    when (val state = account) {
        is LoadState.Loaded -> {
            AccountPlans(
                subscription = state.value.account.subscription,
                alreadyPlus = purchase == PurchaseState.AlreadyPlus,
                website = website,
                navigator = navigator,
                cancellation = cancellation,
                onRetryWebsite = { scope.launch { app.subscriptions.websiteSubscription.refresh() } },
                offer = { Offer(app, navigator, PlanViewer.Free) },
            )
        }

        is LoadState.Failed -> {
            PageColumn { LoadFailedMessage(onRetry = { scope.launch { app.subscriptions.account.refresh() } }) }
        }

        LoadState.Idle, LoadState.Loading, LoadState.Empty -> {
            CircularProgressIndicator()
        }
    }
}

@Composable
internal fun AccountPlans(
    subscription: MeSubscription?,
    website: LoadState<StripeSubscriptionCancellation>,
    navigator: AppNavigator,
    cancellation: WebPlusCancellationViewModel,
    onRetryWebsite: () -> Unit,
    offer: @Composable () -> Unit,
    alreadyPlus: Boolean = false,
) {
    val storePlan = subscription?.takeUnless { it.provider == STRIPE }
    if (storePlan != null) {
        PageColumn {
            if (alreadyPlus) AlreadyPlusMessage(storePlan.provider)
            CurrentPlan(storePlan, navigator)
            when (website) {
                is LoadState.Loaded -> {
                    WebPlusPlan(website.value, cancellation, standalone = false)
                }

                is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = onRetryWebsite)
                }

                LoadState.Idle, LoadState.Loading -> {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.tertiary)
                }

                LoadState.Empty -> {}
            }
        }
        return
    }
    when (website) {
        is LoadState.Loaded -> PageColumn {
            if (alreadyPlus) AlreadyPlusMessage(STRIPE)
            WebPlusPlan(website.value, cancellation)
        }
        is LoadState.Failed -> PageColumn { LoadFailedMessage(onRetry = onRetryWebsite) }
        LoadState.Idle, LoadState.Loading -> CircularProgressIndicator(color = MaterialTheme.colorScheme.tertiary)
        LoadState.Empty -> offer()
    }
}

@Composable
internal fun WebPlusPlan(
    subscription: StripeSubscriptionCancellation,
    cancellation: WebPlusCancellationViewModel,
    standalone: Boolean = true,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(if (standalone) R.string.subscription_plus else R.string.subscription_website),
                Modifier.semantics { heading() },
                style = if (standalone) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium,
            )
            if (standalone && subscription.state != State.UNPAID) {
                val label = if (subscription.state == State.ENDING) R.string.subscription_ending else R.string.subscription_active
                LabelChip(stringResource(label))
            }
        }
        val dateLine =
            if (subscription.state == State.UNPAID) {
                stringResource(R.string.subscription_renewal_failed)
            } else {
                subscription.periodEnd?.let {
                    stringResource(
                        if (subscription.state == State.ENDING) R.string.subscription_ends_on else R.string.subscription_renews_on,
                        planDate(it, currentLocale()),
                    )
                }
            }
        dateLine?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
    }
    if (standalone && subscription.state != State.UNPAID) PlusBenefits()
    if (subscription.state == State.ENDING) KeepWebPlusButton(cancellation) else WebPlusCancelButton(subscription.state, cancellation)
}

@Composable
private fun PageColumn(
    maxWidth: Dp = PAGE_WIDTH,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.widthIn(max = maxWidth).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp), content = content)
}

@Composable
internal fun CurrentPlan(
    subscription: MeSubscription,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val isEnding = subscription.cancelAt != null || subscription.cancelAtPeriodEnd == true
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
                        else -> R.string.subscription_managed_zoonk
                    },
                ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (provider == GOOGLE) {
                Button(
                    onClick = {
                        openWebPage(
                            context,
                            "https://play.google.com/store/account/subscriptions?sku=$PLUS_PRODUCT_ID&package=${context.packageName}",
                        )
                    },
                ) { Text(stringResource(R.string.subscription_manage_google)) }
            }
            OutlinedButton(
                onClick = { navigator.open(AppRoute.Help) },
            ) { Text(stringResource(R.string.subscription_contact_support)) }
        }
    }
}

@Composable
private fun AlreadyPlusMessage(provider: String) {
    Text(
        text =
            stringResource(
                when (provider) {
                    APPLE -> R.string.subscription_already_plus_apple
                    GOOGLE -> R.string.subscription_already_plus_google
                    STRIPE -> R.string.subscription_already_plus_website
                    else -> R.string.subscription_already_plus
                },
            ),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodyLarge,
    )
}

@Composable
private fun dateLine(subscription: MeSubscription): String? {
    val locale = currentLocale()
    val cancelAt = subscription.cancelAt ?: subscription.periodEnd.takeIf { subscription.cancelAtPeriodEnd == true }
    val periodEnd = subscription.periodEnd
    return when {
        cancelAt != null -> stringResource(R.string.subscription_ends_on, planDate(cancelAt, locale))
        periodEnd == null -> null
        else -> stringResource(R.string.subscription_period_ends_on, planDate(periodEnd, locale))
    }
}

@Composable
private fun Offer(
    app: AppContainer,
    navigator: AppNavigator,
    viewer: PlanViewer,
) {
    val offers by app.subscriptions.offers.collectShown()
    val freePlan by app.subscriptions.freePlan.collectShown()
    val purchase by app.subscriptions.purchase.collectAsStateWithLifecycle()
    val activity = LocalActivity.current
    val analytics = LocalEventTracker.current
    val scope = rememberCoroutineScope()
    val onSubscribe: ((PlusOffer) -> Unit)? =
        activity?.let { host ->
            { offer ->
                analytics.track(AnalyticsEvent.SubscriptionCheckoutStarted(offer.period))
                scope.launch { app.subscriptions.buy(host, offer.period) }
            }
        }

    PlanOffer(
        viewer = viewer,
        offers = offers,
        freePlan = freePlan,
        purchase = purchase,
        navigator = navigator,
        onSubscribe = onSubscribe,
        onRetryFreePlan = { scope.launch { app.subscriptions.freePlan.refresh() } },
        messagesUsed = if (viewer == PlanViewer.Free) messagesUsedToday(app) else null,
    )
}

@Composable
private fun messagesUsedToday(app: AppContainer): AllowanceItem? {
    val allowance by app.subscriptions.allowance.collectShown()
    return allowance.value?.items?.firstOrNull { it.kind == AllowanceItem.Kind.TUTOR_MESSAGE }
}

/**
 * Plus beside Free when both fit at [PLAN_MIN_WIDTH], so their prices compare at a glance, with the
 * questions' heading under Plus and the questions under Free; one above the other otherwise.
 */
@Composable
internal fun PlanOffer(
    viewer: PlanViewer,
    offers: LoadState<PlusOffers>,
    freePlan: LoadState<FreePlan>,
    purchase: PurchaseState,
    navigator: AppNavigator,
    onSubscribe: ((PlusOffer) -> Unit)?,
    onRetryFreePlan: () -> Unit,
    messagesUsed: AllowanceItem? = null,
) {
    val limits = freePlan.value
    val hasAccount = viewer == PlanViewer.Free

    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        val sideBySide = minOf(maxWidth, TWO_PLANS_WIDTH) >= PLAN_MIN_WIDTH * LocalDensity.current.fontScale * 2 + PLAN_GAP

        PageColumn(maxWidth = if (sideBySide) TWO_PLANS_WIDTH else PAGE_WIDTH) {
            Text(
                stringResource(R.string.subscription_offer_title),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )

            PlanColumns(sideBySide, verticalSpacing = 24.dp) {
                PlusPlanCard(offers, purchase, hasAccount, navigator, onSubscribe)
                Box {
                    when {
                        limits != null -> {
                            FreePlanCard(
                                limits,
                                currency = offers.value?.let { (it.monthly ?: it.yearly)?.currency },
                                viewer = viewer,
                                navigator = navigator,
                                modifier = Modifier.fillMaxHeight(),
                                messagesUsed = messagesUsed,
                            )
                        }

                        freePlan is LoadState.Failed -> {
                            LoadFailedMessage(onRetry = onRetryFreePlan)
                        }
                    }
                }
            }

            CommonQuestions(limits, hasAccount, navigator, sideBySide)
        }
    }
}

/** Items in equal columns as tall as the tallest, or one above the other; one layout either way, so their state survives a resize. */
@Composable
internal fun PlanColumns(
    sideBySide: Boolean,
    verticalSpacing: Dp,
    content: @Composable () -> Unit,
) {
    Layout(content) { items, constraints ->
        val width = constraints.maxWidth
        if (sideBySide) {
            val gap = PLAN_GAP.roundToPx()
            val column = (width - gap * (items.size - 1)) / items.size
            val height = items.maxOf { it.maxIntrinsicHeight(column) }
            val placed = items.map { it.measure(Constraints.fixed(column, height)) }
            layout(width, height) { placed.forEachIndexed { index, item -> item.placeRelative(index * (column + gap), 0) } }
        } else {
            val spacing = verticalSpacing.roundToPx()
            val placed = items.map { it.measure(constraints.copy(minWidth = width, minHeight = 0)) }
            layout(width, placed.sumOf { it.height } + spacing * (placed.size - 1)) {
                var y = 0
                placed.forEach { item ->
                    item.placeRelative(0, y)
                    y += item.height + spacing
                }
            }
        }
    }
}

/** Main's PlusPlan: Play's price for each billing period and the way to buy it. */
@Composable
private fun PlusPlanCard(
    offers: LoadState<PlusOffers>,
    purchase: PurchaseState,
    hasAccount: Boolean,
    navigator: AppNavigator,
    onSubscribe: ((PlusOffer) -> Unit)?,
) {
    var period by rememberSaveable { mutableStateOf(BillingPeriod.Monthly) }
    val plans = offers.value
    // Play can sell one base plan and not the other in a region: show the one it sells.
    val offer = plans?.let { it.offerFor(period) ?: it.monthly ?: it.yearly }
    val isWorking = purchase == PurchaseState.Buying || purchase == PurchaseState.Confirming
    val canBuy = offer != null || offers is LoadState.Loading

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.subscription_plus), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)

            if (plans?.monthly != null && plans.yearly != null) {
                val billingPeriod = stringResource(R.string.subscription_billing_period)
                SingleChoiceSegmentedButtonRow(
                    Modifier.fillMaxWidth().semantics {
                        isTraversalGroup = true
                        contentDescription = billingPeriod
                    },
                ) {
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
                        onClick = { offer?.let { onSubscribe?.invoke(it) } },
                        enabled = offer != null && !isWorking && onSubscribe != null,
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
                ) { Text(stringResource(R.string.subscription_contact_support)) }
            }
            HorizontalDivider()
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
            PurchaseState.PlanCheckFailed -> R.string.account_failure_network
            PurchaseState.Idle, PurchaseState.Buying, PurchaseState.Done, PurchaseState.AlreadyPlus -> return
        }
    val isProblem = purchase != PurchaseState.Pending && purchase != PurchaseState.Confirming
    Text(
        text = stringResource(message),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (isProblem) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Main's PlusBenefits. */
@Composable
fun PlusBenefits(modifier: Modifier = Modifier) {
    PlanIncludes(
        summary = stringResource(R.string.subscription_benefits_summary),
        items =
            listOf(
                R.string.subscription_benefit_exam,
                R.string.subscription_benefit_mocks,
                R.string.subscription_benefit_buddy,
                R.string.subscription_benefit_calls,
            ).map { stringResource(it) },
        modifier = modifier,
    )
}

/** Main's PlanIncludes: a plan's lead line, then what it includes. */
@Composable
internal fun PlanIncludes(
    summary: String,
    items: List<String>,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(summary, style = MaterialTheme.typography.titleMedium)
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                Icon(
                    painterResource(R.drawable.ic_check),
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(item, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
internal fun Note(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

internal fun planDate(
    instant: Instant,
    locale: Locale,
): String =
    DateTimeFormatter
        .ofLocalizedDate(FormatStyle.MEDIUM)
        .withLocale(locale)
        .format(
            java.time.Instant
                .ofEpochMilli(instant.toEpochMilliseconds())
                .atZone(ZoneId.systemDefault()),
        )

internal fun money(
    micros: Long,
    currency: String,
    locale: Locale,
): String =
    NumberFormat
        .getCurrencyInstance(locale)
        .apply {
            this.currency = Currency.getInstance(currency)
            // Main's formatPrice: a whole amount reads "$60", not "$60.00".
            if (micros % 1_000_000 == 0L) maximumFractionDigits = 0
        }.format(micros / 1_000_000.0)

private const val GOOGLE = "google"
private const val APPLE = "apple"
internal const val STRIPE = "stripe"

private val PAGE_WIDTH = 640.dp

/** Main's 64rem plans row. */
private val TWO_PLANS_WIDTH = 1024.dp

/** The narrowest a plan card keeps Plus's billing switch readable, at 100% text. */
private val PLAN_MIN_WIDTH = 360.dp
private val PLAN_GAP = 16.dp
