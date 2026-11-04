package com.zoonk.android.feature.mock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LocalButtonSize
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.ExamMockSummary
import com.zoonk.api.models.MockOptions

/** A finished mock: its number, when and what it covered, and how it went; [onOpen] opens its result. [stacked] puts how it went under the line. */
@Composable
fun MockSummaryRow(
    mock: ExamMockSummary,
    onOpen: (() -> Unit)?,
    stacked: Boolean,
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
        stacked = stacked,
    )
}

/**
 * Main's list row for mocks in the page's column (the shared `ListRow`, reaching past the column's
 * margin): a mark, a title over a line, and a short fact at the end, or under the line when
 * [stacked]. [current] is the row the learner is on, on its fill, and TalkBack says so.
 */
@Composable
fun MockListRow(
    headline: @Composable () -> Unit,
    supporting: String,
    trailing: String?,
    leading: @Composable () -> Unit,
    onClick: (() -> Unit)?,
    stacked: Boolean,
    modifier: Modifier = Modifier,
    current: Boolean = false,
) {
    ListRow(
        headline = headline,
        modifier = modifier.bleed(LIST_ITEM_INSET),
        onClick = onClick,
        highlighted = current,
        stateDescription = if (current) stringResource(R.string.exam_current) else null,
        leading = leading,
        supporting = {
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(supporting)
                // Under the line, the fact is the row's quietest words.
                if (trailing != null && stacked) Text(trailing, style = factStyle())
            }
        },
        meta = if (trailing != null && !stacked) ({ Text(trailing) }) else null,
    )
}

/**
 * Whether a list of mock rows [width] wide puts its facts under their lines: all of them once one
 * would squeeze its title (large fonts, narrow windows), so the rows keep one shape.
 */
@Composable
fun factsUnderLines(
    facts: List<String>,
    width: Dp,
): Boolean {
    val measurer = rememberTextMeasurer()
    val style = factStyle()
    val limit = with(LocalDensity.current) { width.toPx() } * TRAILING_SHARE
    return facts.any { measurer.measure(it, style).size.width > limit }
}

@Composable
private fun factStyle() = MaterialTheme.zoonkType.data

/** Where a mock taken any time starts or continues; null when the goal offers none. */
fun mockEntryRoute(options: MockOptions): AppRoute? =
    options.running?.let { AppRoute.Mock(it.id.toString()) } ?: AppRoute.MockChooser.takeIf { options.options.isNotEmpty() }

/** The page's main action: take a mock, or go back to the one running. Free learners see it marked Plus. */
@Composable
fun MockEntryButton(
    options: MockOptions,
    onOpen: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
    size: ButtonSize = LocalButtonSize.current,
) {
    val route = mockEntryRoute(options) ?: return
    val running = options.running != null

    Button(onClick = { onOpen(route) }, modifier = modifier, size = size, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
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
