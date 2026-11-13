package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.OutlinedButton

/** Main's `GateWords`: what stopped, and at most one line under it. */
@Composable
fun GateWords(
    title: String?,
    line: String?,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        title?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
        line?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
    }
}

/** The one action that leads to paying, small, in place of what the learner tried. */
@Composable
fun SubscribeButton(onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, size = ButtonSize.Small) { Text(stringResource(R.string.subscription_subscribe)) }
}

/** A guest's way on, where a subscriber's would be [SubscribeButton]. */
@Composable
fun CreateAccountButton(onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        size = ButtonSize.Small,
        leadingIcon = { ButtonIcon(R.drawable.ic_person_add) },
    ) { Text(stringResource(R.string.limit_create_account)) }
}

/**
 * Main's `SubscribeGate`: where a learner tried something that needs a subscription, in place of
 * what they asked for, on the column's edge with no card or icon. Nothing announces it before the try.
 *
 * - [line] is at most one sentence, only where the learner would otherwise think they're stuck.
 * - [action] is one way on that isn't paying, such as "Go to your Plan", after "Subscribe".
 */
@Composable
fun SubscribeGate(
    title: String,
    onSubscribe: () -> Unit,
    modifier: Modifier = Modifier,
    line: String? = null,
    action: (@Composable () -> Unit)? = null,
) {
    GateLayout(title, line, modifier) {
        SubscribeButton(onSubscribe)
        action?.invoke()
    }
}

/** [GateWords] over the gate's buttons, read out when it appears. */
@Composable
internal fun GateLayout(
    title: String?,
    line: String?,
    modifier: Modifier = Modifier,
    buttons: (@Composable () -> Unit)?,
) {
    Column(
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.Start,
    ) {
        GateWords(title, line)
        buttons?.let {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { it() }
        }
    }
}
