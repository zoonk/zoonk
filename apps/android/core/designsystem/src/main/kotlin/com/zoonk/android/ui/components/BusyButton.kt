package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/*
 * Main's busy buttons. From the press until its work ends ([busy]), a button ignores presses but
 * keeps focus, which a disabled one would drop, reads as unavailable and looks as it did, so a quick
 * save shows nothing. Once the wait turns slow ([rememberSlowWait]) a spinner covers its content,
 * which keeps its place and its words for TalkBack, so the button never changes size; the content is
 * back the moment the work ends. A label stays as it was at rest.
 */

@Composable
fun BusyButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors = ButtonDefaults.buttonColors(),
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit,
) = Button(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
    colors = colors,
    contentPadding = contentPadding,
) { BusyRow(busy, content) }

@Composable
fun BusyTonalButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = ButtonDefaults.filledTonalShape,
    content: @Composable RowScope.() -> Unit,
) = FilledTonalButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
    shape = shape,
) { BusyRow(busy, content) }

@Composable
fun BusyOutlinedButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit,
) = OutlinedButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
    contentPadding = contentPadding,
) { BusyRow(busy, content) }

@Composable
fun BusyTextButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors = ButtonDefaults.textButtonColors(),
    contentPadding: PaddingValues = ButtonDefaults.TextButtonContentPadding,
    content: @Composable RowScope.() -> Unit,
) = TextButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
    colors = colors,
    contentPadding = contentPadding,
) { BusyRow(busy, content) }

@Composable
fun BusyIconButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) = IconButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
) { BusyContent(busy, content) }

@Composable
fun BusyFilledIconButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) = FilledIconButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
) { BusyContent(busy, content) }

private fun Modifier.busy(busy: Boolean): Modifier = semantics { if (busy) disabled() }

@Composable
private fun BusyRow(
    busy: Boolean,
    content: @Composable RowScope.() -> Unit,
) = BusyContent(busy) { Row(verticalAlignment = Alignment.CenterVertically, content = content) }

@Composable
private fun BusyContent(
    busy: Boolean,
    content: @Composable () -> Unit,
) {
    val slow = rememberSlowWait(busy)

    Box(contentAlignment = Alignment.Center) {
        Box(Modifier.alpha(if (slow) 0f else 1f)) { content() }
        if (slow) {
            CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
        }
    }
}
