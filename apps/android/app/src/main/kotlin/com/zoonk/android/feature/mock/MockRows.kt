package com.zoonk.android.feature.mock

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamMockSummary
import com.zoonk.api.models.MockOptions

/** A finished mock: its number, when and what it covered, and how it went; [onOpen] opens its result. */
@Composable
fun MockSummaryRow(
    mock: ExamMockSummary,
    onOpen: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val label = mockSummaryLabel(mock)
    val date = mockDate(mock.finishedAt)

    MockListRow(
        headline = { Text(mockTitle(mock.number)) },
        supporting = if (label.isEmpty()) date else stringResource(R.string.mock_row_detail, date, label),
        trailing = mockMeasure(mock),
        leading = { StatusMark(MarkStatus.Done) },
        onClick = onOpen,
        modifier = modifier,
    )
}

/**
 * Main's list row for mocks: a mark, a title over a line, and a short fact at the end that moves under
 * the line when it would squeeze the title (large fonts, narrow windows).
 */
@Composable
fun MockListRow(
    headline: @Composable () -> Unit,
    supporting: String,
    trailing: String?,
    leading: @Composable () -> Unit,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val trailingStyle = MaterialTheme.typography.labelMedium.withTabularFigures()
    val measurer = rememberTextMeasurer()

    BoxWithConstraints(if (onClick != null) modifier.fillMaxWidth().clickable(onClick = onClick) else modifier.fillMaxWidth()) {
        val stacked = trailing != null && measurer.measure(trailing, trailingStyle).size.width > constraints.maxWidth * TRAILING_SHARE
        Row(
            Modifier.heightIn(min = 64.dp).padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            leading()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                ProvideTextStyle(MaterialTheme.typography.bodyLarge) { headline() }
                Text(supporting, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                if (stacked) Text(trailing, color = MaterialTheme.colorScheme.onSurfaceVariant, style = trailingStyle)
            }
            if (trailing != null && !stacked) Text(trailing, color = MaterialTheme.colorScheme.onSurfaceVariant, style = trailingStyle)
        }
    }
}

/** Where a mock taken any time starts or continues; null when the goal offers none. */
fun mockEntryRoute(options: MockOptions): AppRoute? =
    options.running?.let { AppRoute.Mock(it.id.toString()) } ?: AppRoute.MockChooser.takeIf { options.options.isNotEmpty() }

/** The page's main action: take a mock, or go back to the one running. Free learners see it marked Plus. */
@Composable
fun MockEntryButton(
    options: MockOptions,
    onOpen: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    val route = mockEntryRoute(options) ?: return
    val running = options.running != null

    Button(onClick = { onOpen(route) }, modifier = modifier, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
        Icon(painterResource(R.drawable.ic_timer), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
        Text(
            text = stringResource(if (running) R.string.mock_continue else R.string.mock_take),
            modifier = Modifier.padding(start = ButtonDefaults.IconSpacing),
        )
        if (!running && options.access == MockOptions.Access.PLUS_REQUIRED) {
            OnButton { PlusMark(Modifier.padding(start = ButtonDefaults.IconSpacing)) }
        }
    }
}

/** The shared Plus chip inside a filled button, drawn in the button's content color as main's is. */
@Composable
private fun OnButton(content: @Composable () -> Unit) {
    val color = LocalContentColor.current
    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme.copy(onSurfaceVariant = color, outline = color.copy(alpha = PLUS_MARK_EDGE_ALPHA)),
        content = content,
    )
}

private const val PLUS_MARK_EDGE_ALPHA = 0.5f
private const val TRAILING_SHARE = 0.3f
