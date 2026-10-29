package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's Plus notice, the lock on a Plus feature: Plus features are never hidden, and their screen
 * says here what Plus unlocks, inline where the locked things are, at most one per screen.
 *
 * - [title] replaces "Available with Plus" where something the free plan had ends.
 * - [onSeePlus] null drops See Plus where the screen's main action already leads to Plus.
 * - [inset] drops the card inside a row or card that already has one.
 * - [action] is the free way, after See Plus.
 */
@Composable
fun PlusNotice(
    onSeePlus: (() -> Unit)?,
    modifier: Modifier = Modifier,
    title: String = stringResource(R.string.subscription_available_with_plus),
    description: String? = null,
    inset: Boolean = false,
    action: (@Composable () -> Unit)? = null,
) {
    val content: @Composable () -> Unit = {
        Row(
            modifier = if (inset) Modifier else Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(painterResource(R.drawable.ic_auto_awesome), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
                description?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
                if (onSeePlus != null || action != null) {
                    FlowRow(
                        modifier = Modifier.padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        onSeePlus?.let {
                            OutlinedButton(
                                onClick = it,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
                            ) { Text(stringResource(R.string.subscription_see_plus)) }
                        }
                        action?.invoke()
                    }
                }
            }
        }
    }

    if (inset) {
        Column(modifier) { content() }
    } else {
        OutlinedCard(modifier.fillMaxWidth()) { content() }
    }
}
