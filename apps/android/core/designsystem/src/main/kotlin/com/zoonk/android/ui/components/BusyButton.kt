package com.zoonk.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonColors
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/*
 * Main's busy buttons. From the press until its work ends ([busy]), a button ignores presses and
 * takes its disabled colors but stays enabled underneath, so it keeps the focus a disabled one would
 * drop, and reads as unavailable. Once the wait turns slow, [BusyContent] covers its content with a
 * spinner, so the button never changes size; the content is back the moment the work ends. A label
 * stays as it was at rest. The content padding goes inside [BusyContent], so the spinner centers on
 * the whole button however that padding leans.
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
    colors = colors.disabledWhen(busy),
    contentPadding = NO_PADDING,
) { BusyRow(busy, contentPadding, content) }

@Composable
fun BusyTonalButton(
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = ButtonDefaults.filledTonalShape,
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit,
) = FilledTonalButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
    shape = shape,
    colors = ButtonDefaults.filledTonalButtonColors().disabledWhen(busy),
    contentPadding = NO_PADDING,
) { BusyRow(busy, contentPadding, content) }

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
    colors = outlinedButtonColors().disabledWhen(busy),
    border = outlinedButtonBorder(enabled && !busy),
    contentPadding = NO_PADDING,
) { BusyRow(busy, contentPadding, content) }

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
    colors = colors.disabledWhen(busy),
    contentPadding = NO_PADDING,
) { BusyRow(busy, contentPadding, content) }

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
    colors = IconButtonDefaults.iconButtonColors().disabledWhen(busy),
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
    colors = IconButtonDefaults.filledIconButtonColors().disabledWhen(busy),
) { BusyContent(busy, content) }

/** A row's tap, busy as a [BusyButton] is: ignored while [busy], with the row keeping focus and reading as unavailable. */
fun Modifier.busyClickable(
    busy: Boolean,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    onClick: () -> Unit,
): Modifier = clickable(enabled = enabled || busy, onClickLabel = onClickLabel, role = Role.Button) { if (!busy) onClick() }.busy(busy)

private fun Modifier.busy(busy: Boolean): Modifier = semantics { if (busy) disabled() }

private fun ButtonColors.disabledWhen(busy: Boolean): ButtonColors =
    if (busy) copy(containerColor = disabledContainerColor, contentColor = disabledContentColor) else this

private fun IconButtonColors.disabledWhen(busy: Boolean): IconButtonColors =
    if (busy) copy(containerColor = disabledContainerColor, contentColor = disabledContentColor) else this

@Composable
private fun BusyRow(
    busy: Boolean,
    padding: PaddingValues,
    content: @Composable RowScope.() -> Unit,
) = BusyBox(busy, padding) { Row(verticalAlignment = Alignment.CenterVertically, content = content) }

/**
 * [content] until a [busy] wait turns slow, then a spinner in its place at its size: a button's whole
 * content, or only a row's mark (its icon, chevron or time) so the row's words stay. The content is
 * left undrawn rather than transparent, which TalkBack would skip.
 */
@Composable
fun BusyContent(
    busy: Boolean,
    content: @Composable () -> Unit,
) = BusyBox(busy, NO_PADDING, content)

/** [BusyContent] with [padding] around the content, which the spinner centers on too. */
@Composable
private fun BusyBox(
    busy: Boolean,
    padding: PaddingValues,
    content: @Composable () -> Unit,
) {
    val slow = rememberSlowWait(busy)

    Box(contentAlignment = Alignment.Center) {
        Box(Modifier.padding(padding).drawWithContent { if (!slow) drawContent() }) { content() }
        if (slow) {
            CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
        }
    }
}

private val NO_PADDING = PaddingValues()
