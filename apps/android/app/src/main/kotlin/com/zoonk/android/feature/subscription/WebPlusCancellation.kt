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
import com.zoonk.android.data.MutationResult
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
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

/** Canceling a Plus bought on the web, kept across recreation so a refund's receipt isn't lost. */
class WebPlusCancellationViewModel(
    private val readOptions: suspend () -> MutationResult<StripeSubscriptionCancellation>,
    private val send: suspend (withdraw: Boolean) -> MutationResult<StripeSubscriptionCancellationReceipt>,
) : ViewModel() {
    var step by mutableStateOf<WebPlusCancellationStep>(WebPlusCancellationStep.Closed)
        private set
    var isOpening by mutableStateOf(false)
        private set

    /** The choice on its way: true withdraws. */
    var sending by mutableStateOf<Boolean?>(null)
        private set
    var failed by mutableStateOf(false)
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

    fun cancel(withdraw: Boolean) {
        if (step !is WebPlusCancellationStep.Choosing || sending != null) return
        sending = withdraw
        failed = false
        viewModelScope.launch {
            when (val result = send(withdraw)) {
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
}

/** Main's `CancelPlusButton`. */
@Composable
internal fun WebPlusCancelButton(cancellation: WebPlusCancellationViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(
            onClick = cancellation::open,
            enabled = !cancellation.isOpening,
        ) { PendingLabel(cancellation.isOpening, stringResource(R.string.subscription_cancel)) }
        if (cancellation.failed && cancellation.step == WebPlusCancellationStep.Closed) CancelFailed()
    }
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
                if (cancellation.failed) CancelFailed()
            }
        },
        // Up to three long labels don't fit side by side, so the actions stack with the confirming ones on top.
        confirmButton = {
            Column(horizontalAlignment = Alignment.End) {
                if (options.withdrawal != null) {
                    TextButton(onClick = { cancellation.cancel(withdraw = true) }, enabled = sending == null) {
                        PendingLabel(sending == true, stringResource(R.string.subscription_cancel_withdraw))
                    }
                }
                if (options.cancellation != null) {
                    TextButton(onClick = { cancellation.cancel(withdraw = false) }, enabled = sending == null) {
                        PendingLabel(sending == false, stringResource(R.string.subscription_cancel_confirm))
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
private fun CancelFailed() {
    Text(
        stringResource(R.string.subscription_cancel_failed),
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}
