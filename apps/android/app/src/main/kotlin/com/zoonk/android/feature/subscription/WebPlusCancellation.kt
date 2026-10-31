package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.R
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import com.zoonk.api.models.StripeSubscriptionCancellationRequest.Choice
import kotlinx.coroutines.launch

sealed interface WebPlusCancellationStep {
    data object Closed : WebPlusCancellationStep

    data class Choosing(
        val options: StripeSubscriptionCancellation,
    ) : WebPlusCancellationStep

    data class Canceled(
        val receipt: StripeSubscriptionCancellationReceipt,
    ) : WebPlusCancellationStep

    /** The option the learner chose closed meanwhile. */
    data object Unavailable : WebPlusCancellationStep
}

/** Canceling a Plus bought on the web, or keeping it, kept across recreation so a refund's receipt isn't lost. */
class WebPlusCancellationViewModel(
    private val readOptions: suspend () -> MutationResult<StripeSubscriptionCancellation>,
    private val send: suspend (Choice) -> MutationResult<StripeSubscriptionCancellationReceipt>,
    private val keepPlus: suspend () -> MutationResult<Unit>,
) : ViewModel() {
    var step by mutableStateOf<WebPlusCancellationStep>(WebPlusCancellationStep.Closed)
        private set
    var isOpening by mutableStateOf(false)
        private set

    var sending by mutableStateOf<Choice?>(null)
        private set
    var failed by mutableStateOf(false)
        private set

    var isKeeping by mutableStateOf(false)
        private set
    var keepFailed by mutableStateOf(false)
        private set

    fun open() {
        if (isOpening) return
        isOpening = true
        failed = false
        viewModelScope.launch {
            when (val result = readOptions()) {
                is MutationResult.Done -> {
                    step = WebPlusCancellationStep.Choosing(result.value)
                }

                // Nothing is left to cancel: the plan, read again, shows why.
                is MutationResult.Failed -> {
                    failed = result.error != ApiError.NotFound
                }

                MutationResult.Obsolete -> {}
            }
            isOpening = false
        }
    }

    /** Opens choices already read, such as the refund still open after the renewal stopped. */
    fun open(options: StripeSubscriptionCancellation) {
        failed = false
        step = WebPlusCancellationStep.Choosing(options)
    }

    fun cancel(choice: Choice) {
        if (step !is WebPlusCancellationStep.Choosing || sending != null) return
        sending = choice
        failed = false
        viewModelScope.launch {
            when (val result = send(choice)) {
                is MutationResult.Done -> {
                    step = WebPlusCancellationStep.Canceled(result.value)
                }

                is MutationResult.Failed if result.status == HTTP_CONFLICT -> {
                    step = WebPlusCancellationStep.Unavailable
                }

                is MutationResult.Failed -> {
                    failed = true
                }

                MutationResult.Obsolete -> {
                    step = WebPlusCancellationStep.Closed
                }
            }
            sending = null
        }
    }

    fun close() {
        if (sending == null) step = WebPlusCancellationStep.Closed
    }

    /** The plan read again shows Plus renewing, or, after a 409, what's true now. */
    fun keep() {
        if (isKeeping) return
        isKeeping = true
        keepFailed = false
        viewModelScope.launch {
            val result = keepPlus()
            keepFailed = result is MutationResult.Failed && result.status != HTTP_CONFLICT
            isKeeping = false
        }
    }
}

/** Main's `CancelPlusButton`. */
@Composable
internal fun WebPlusCancelButton(cancellation: WebPlusCancellationViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(
            onClick = cancellation::open,
            enabled = !cancellation.isOpening,
        ) { PendingLabel(cancellation.isOpening, stringResource(R.string.subscription_cancel)) }
        val failed = cancellation.failed && cancellation.step == WebPlusCancellationStep.Closed
        if (failed) Failure(stringResource(R.string.subscription_cancel_failed))
    }
}

/** Main's `EndingPlanActions`: an ending Plus can be kept while only its renewal stopped, and refunded while the 14 days last. */
@Composable
internal fun EndingWebPlus(
    choices: Resource<StripeSubscriptionCancellation>,
    cancellation: WebPlusCancellationViewModel,
) {
    val state by choices.collectShown()
    val scope = rememberCoroutineScope()
    val failed = state as? LoadState.Failed
    if (failed != null && failed.error != ApiError.NotFound) {
        LoadFailedMessage(onRetry = { scope.launch { choices.refresh() } })
        return
    }
    val options = state.value ?: return
    val withdrawal = options.withdrawal
    if (!options.canResumeRenewal && withdrawal == null) return
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        if (options.canResumeRenewal) KeepPlus(cancellation)
        if (withdrawal != null) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Explanation(stringResource(R.string.subscription_refund_still_open, planDate(withdrawal.until, currentLocale())))
                OutlinedButton(onClick = { cancellation.open(options) }) { Text(stringResource(R.string.subscription_get_refund)) }
            }
        }
    }
}

@Composable
private fun Explanation(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun KeepPlus(cancellation: WebPlusCancellationViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Explanation(stringResource(R.string.subscription_keep_plus_description))
        OutlinedButton(onClick = cancellation::keep, enabled = !cancellation.isKeeping) {
            PendingLabel(cancellation.isKeeping, stringResource(R.string.subscription_keep_plus))
        }
        if (cancellation.keepFailed) Failure(stringResource(R.string.subscription_keep_failed))
    }
}

/**
 * Main's `DeletionPlusNotice`: what deleting the account does to [subscription] when it's Plus bought
 * on the web. Null for any other plan, or when the read failed, which never stops the deletion.
 */
@Composable
internal fun webPlusDeletionNotice(
    subscription: MeSubscription?,
    choices: Resource<StripeSubscriptionCancellation>,
): String? {
    if (subscription?.provider != STRIPE) return null
    val state by choices.collectShown()
    val deletion = state.value?.accountDeletion ?: return null
    val refund = deletion.refund ?: return stringResource(R.string.subscription_deletion_no_refund)
    return stringResource(R.string.subscription_deletion_refund, money(refund, currentLocale()))
}

/** Shown above whatever the plan becomes, so the receipt stays after Plus ends. */
@Composable
internal fun WebPlusCancellationDialog(cancellation: WebPlusCancellationViewModel) {
    when (val step = cancellation.step) {
        WebPlusCancellationStep.Closed -> {}

        is WebPlusCancellationStep.Choosing -> {
            CancelChoices(step.options, cancellation)
        }

        is WebPlusCancellationStep.Canceled -> {
            Notice(receipt(step.receipt), cancellation::close)
        }

        WebPlusCancellationStep.Unavailable -> {
            Notice(stringResource(R.string.subscription_cancel_unavailable), cancellation::close)
        }
    }
}

@Composable
private fun CancelChoices(
    options: StripeSubscriptionCancellation,
    cancellation: WebPlusCancellationViewModel,
) {
    val locale = currentLocale()
    val sending = cancellation.sending

    AlertDialog(
        onDismissRequest = cancellation::close,
        title = { Text(stringResource(R.string.subscription_cancel_title)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                options.withdrawal?.let {
                    Text(stringResource(R.string.subscription_cancel_withdrawal, planDate(it.until, locale), money(it.refund, locale)))
                }
                options.cancellation?.let {
                    val endsAt = planDate(it.endsAt, locale)
                    val refund = it.refund
                    Text(
                        if (refund == null) {
                            stringResource(R.string.subscription_cancel_at_period_end, endsAt)
                        } else {
                            stringResource(R.string.subscription_cancel_at_period_end_refund, endsAt, money(refund, locale))
                        },
                    )
                }
                Text(stringResource(R.string.subscription_cancel_email))
                if (cancellation.failed) Failure(stringResource(R.string.subscription_cancel_failed))
            }
        },
        // Up to three long labels don't fit side by side, so the actions stack with the confirming ones on top.
        confirmButton = {
            Column(horizontalAlignment = Alignment.End) {
                if (options.withdrawal != null) {
                    TextButton(onClick = { cancellation.cancel(Choice.WITHDRAWAL) }, enabled = sending == null) {
                        PendingLabel(sending == Choice.WITHDRAWAL, stringResource(R.string.subscription_cancel_withdraw))
                    }
                }
                if (options.cancellation != null) {
                    TextButton(onClick = { cancellation.cancel(Choice.ORDINARY) }, enabled = sending == null) {
                        PendingLabel(sending == Choice.ORDINARY, stringResource(R.string.subscription_cancel_confirm))
                    }
                }
                TextButton(onClick = cancellation::close, enabled = sending == null) {
                    Text(stringResource(R.string.subscription_keep_plus))
                }
            }
        },
    )
}

@Composable
private fun receipt(receipt: StripeSubscriptionCancellationReceipt): String {
    val refund = receipt.refund ?: return stringResource(R.string.subscription_canceled)
    return stringResource(R.string.subscription_canceled_refund, money(refund, currentLocale()))
}

@Composable
private fun Notice(
    text: String,
    onClose: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onClose,
        text = { Text(text) },
        confirmButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.subscription_ok)) } },
    )
}

@Composable
private fun Failure(text: String) {
    Text(
        text,
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}
