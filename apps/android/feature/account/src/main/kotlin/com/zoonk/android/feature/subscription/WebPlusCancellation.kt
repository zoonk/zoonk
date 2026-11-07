package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.components.TextButton
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellation.State
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import kotlinx.coroutines.launch

class WebPlusCancellationViewModel(
    private val send: suspend () -> MutationResult<StripeSubscriptionCancellationReceipt>,
    private val keepPlus: suspend () -> MutationResult<Unit>,
) : ViewModel() {
    var confirmation by mutableStateOf<State?>(null)
        private set
    var isSending by mutableStateOf(false)
        private set
    var failed by mutableStateOf(false)
        private set
    var isKeeping by mutableStateOf(false)
        private set
    var keepFailed by mutableStateOf(false)
        private set

    fun open(state: State) {
        if (isSending || state == State.ENDING) return
        confirmation = state
        failed = false
    }

    fun cancel() {
        if (confirmation == null || isSending) return
        isSending = true
        failed = false
        viewModelScope.launch {
            when (val result = send()) {
                is MutationResult.Done, MutationResult.Obsolete -> {
                    confirmation = null
                }

                is MutationResult.Failed -> {
                    if (result.status == HTTP_CONFLICT) confirmation = null else failed = true
                }
            }
            isSending = false
        }
    }

    fun close() {
        if (!isSending) confirmation = null
    }

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

@Composable
internal fun WebPlusCancelButton(
    state: State,
    cancellation: WebPlusCancellationViewModel,
) {
    OutlinedButton(onClick = { cancellation.open(state) }) {
        Text(stringResource(R.string.subscription_cancel))
    }
}

@Composable
internal fun KeepWebPlusButton(cancellation: WebPlusCancellationViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.subscription_keep_plus_description),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedButton(onClick = cancellation::keep, enabled = !cancellation.isKeeping) {
            PendingLabel(cancellation.isKeeping, stringResource(R.string.subscription_keep_plus))
        }
        if (cancellation.keepFailed) Failure(stringResource(R.string.subscription_keep_failed))
    }
}

@Composable
internal fun webPlusDeletionNotice(subscription: Resource<StripeSubscriptionCancellation>): String? {
    val state by subscription.collectShown()
    return if (state.value != null) stringResource(R.string.subscription_deletion_notice) else null
}

@Composable
internal fun WebPlusCancellationDialog(cancellation: WebPlusCancellationViewModel) {
    val status = cancellation.confirmation ?: return
    AlertDialog(
        onDismissRequest = cancellation::close,
        title = { Text(stringResource(R.string.subscription_cancel_title)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    stringResource(
                        if (status == State.UNPAID) R.string.subscription_cancel_unpaid else R.string.subscription_cancel_at_period_end,
                    ),
                )
                if (cancellation.failed) Failure(stringResource(R.string.subscription_cancel_failed))
            }
        },
        confirmButton = {
            TextButton(onClick = cancellation::cancel, enabled = !cancellation.isSending) {
                PendingLabel(cancellation.isSending, stringResource(R.string.subscription_cancel))
            }
        },
        dismissButton = {
            TextButton(onClick = cancellation::close, enabled = !cancellation.isSending) {
                Text(stringResource(R.string.subscription_cancel_back))
            }
        },
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
