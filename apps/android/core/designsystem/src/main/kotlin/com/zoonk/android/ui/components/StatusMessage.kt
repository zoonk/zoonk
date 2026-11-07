package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProgressIndicatorDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.scaffold.BeforeFold

@Composable
fun StatusMessage(
    @DrawableRes icon: Int,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actions: @Composable ColumnScope.() -> Unit,
) {
    val scroll = rememberScrollState()

    BeforeFold(modifier) { beforeFold ->
        BoxWithConstraints(beforeFold) {
            // A list measures it without a height limit, which verticalScroll rejects; the list scrolls it there.
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .then(if (constraints.hasBoundedHeight) Modifier.verticalScroll(scroll) else Modifier)
                        .padding(horizontal = 24.dp, vertical = 48.dp),
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
    }
}

/** What a page or a screen shows while it loads: a spinner in its middle, on the page before an unfolded book's fold. */
@Composable
fun PageLoading(
    modifier: Modifier = Modifier,
    color: Color = ProgressIndicatorDefaults.circularColor,
) {
    BeforeFold(modifier.fillMaxSize()) { beforeFold ->
        Box(beforeFold.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = color) }
    }
}

/** It can't tell a dropped connection from a failure on Zoonk's side, so it blames neither. */
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

@Composable
fun NotFoundMessage(
    onGoHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    StatusMessage(
        icon = R.drawable.ic_search_off,
        title = stringResource(R.string.not_found_title),
        description = stringResource(R.string.not_found_description),
        modifier = modifier,
    ) {
        Button(onClick = onGoHome) { Text(stringResource(R.string.not_found_go_home)) }
    }
}

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

/** Main's `max-w-md`: a readable line however wide the window. */
private val READABLE_WIDTH = 448.dp
