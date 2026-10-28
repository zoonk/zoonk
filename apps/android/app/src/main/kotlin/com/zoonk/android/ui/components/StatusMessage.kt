package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * What a screen that couldn't show says, as one centered unit: a quiet symbol (bare, never on a
 * tile), what happened in plain words as its heading, a line on why, and the way on, the one main
 * action first. Failed loads and missing pages share it, so they read the same.
 */
@Composable
fun StatusMessage(
    @DrawableRes icon: Int,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actions: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(32.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.size(16.dp))
        Text(
            text = title,
            modifier = Modifier.widthIn(max = READABLE_WIDTH).semantics { heading() },
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.headlineSmall,
        )
        Spacer(Modifier.size(8.dp))
        Text(
            text = description,
            modifier = Modifier.widthIn(max = READABLE_WIDTH),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.size(24.dp))
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = actions,
        )
    }
}

/**
 * A screen whose data didn't load says so calmly and offers to try again. It can't tell a dropped
 * connection from a failure on Zoonk's side, so it blames neither. Inside the app's frame the
 * navigation stays, so the learner can also go elsewhere; `actions` adds a quieter way on.
 */
@Composable
fun LoadFailedMessage(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable ColumnScope.() -> Unit = {},
) {
    StatusMessage(
        icon = R.drawable.ic_warning,
        title = stringResource(R.string.load_failed_title),
        description = stringResource(R.string.load_failed_description),
        modifier = modifier,
    ) {
        Button(onClick = onRetry, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
            Icon(
                painter = painterResource(R.drawable.ic_refresh),
                contentDescription = null,
                modifier = Modifier.size(ButtonDefaults.IconSize),
            )
            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
            Text(stringResource(R.string.load_failed_try_again))
        }
        actions()
    }
}

/**
 * A place with nothing in it yet, said plainly where its content would be: a quiet symbol, a short
 * heading, one line and the one thing to do, aligned to the content's start edge. No card, no tile.
 */
@Composable
fun EmptyState(
    @DrawableRes icon: Int,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier.widthIn(max = READABLE_WIDTH)) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.size(12.dp))
        Text(text = title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(4.dp))
        Text(
            text = description,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )

        if (action != null) {
            Spacer(Modifier.size(16.dp))
            action()
        }
    }
}

/** A readable line for a message's words, however wide the window (main's `max-w-md`). */
private val READABLE_WIDTH = 448.dp
