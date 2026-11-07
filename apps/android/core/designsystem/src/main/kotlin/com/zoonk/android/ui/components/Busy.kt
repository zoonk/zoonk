package com.zoonk.android.ui.components

import androidx.compose.foundation.Indication
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/*
 * Main's busy state, for every button in Buttons.kt and for rows. From the press until its work ends
 * (`busy`), a control shows a spinner in its icon's place, keeps its label and its colors, ignores
 * presses, and stays enabled underneath, so it keeps the focus a disabled one would drop. A button with
 * no icon covers its label with the spinner instead, so it never changes size. A disabled button that
 * is `focusableWhenDisabled`, as main's is while another button's request runs, keeps its focus the
 * same way but looks disabled and shows no spinner.
 */

/** A row's tap, busy as a button is: ignored while [busy], with the row keeping focus and reading as unavailable. */
fun Modifier.busyClickable(
    busy: Boolean,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    onClick: () -> Unit,
): Modifier = clickable(enabled = enabled || busy, onClickLabel = onClickLabel, role = Role.Button) { if (!busy) onClick() }.busy(busy)

/** [busyClickable] for a row that draws its own [indication] from [interactionSource], such as inside its highlight. */
fun Modifier.busyClickable(
    busy: Boolean,
    interactionSource: MutableInteractionSource?,
    indication: Indication?,
    enabled: Boolean = true,
    onClick: () -> Unit,
): Modifier = clickable(interactionSource, indication, enabled = enabled || busy, role = Role.Button) { if (!busy) onClick() }.busy(busy)

/**
 * [content], or while [busy] a spinner over it at its size: an icon button's icon, a row's mark (its
 * icon, chevron or time) so the row's words stay, or a button's label when it has no icon. The content
 * is left undrawn rather than transparent, which TalkBack would skip.
 */
@Composable
fun BusyContent(
    busy: Boolean,
    content: @Composable () -> Unit,
) {
    Box(contentAlignment = Alignment.Center) {
        Box(Modifier.drawWithContent { if (!busy) drawContent() }) { content() }
        if (busy) Spinner(Modifier.matchParentSize().wrapContentSize(unbounded = true).size(ButtonDefaults.IconSize))
    }
}

internal fun held(
    busy: Boolean,
    enabled: Boolean,
    focusableWhenDisabled: Boolean,
) = busy || (focusableWhenDisabled && !enabled)

internal fun Modifier.busy(busy: Boolean): Modifier = semantics { if (busy) disabled() }

internal fun ButtonColors.disabledWhen(waiting: Boolean): ButtonColors =
    if (waiting) copy(containerColor = disabledContainerColor, contentColor = disabledContentColor) else this

/** A button's [icon] and words with [padding] around them; while [busy], a spinner takes the icon's place, or covers the words without one. */
@Composable
internal fun ButtonContent(
    busy: Boolean,
    icon: (@Composable () -> Unit)?,
    iconSize: Dp,
    padding: PaddingValues,
    content: @Composable RowScope.() -> Unit,
) {
    if (icon == null) {
        BusyContent(busy) { Row(Modifier.padding(padding), verticalAlignment = Alignment.CenterVertically, content = content) }
        return
    }

    Row(Modifier.padding(padding), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(iconSize), propagateMinConstraints = true) { if (busy) Spinner(Modifier) else icon() }
        Spacer(Modifier.width(ButtonDefaults.IconSpacing))
        content()
    }
}

@Composable
private fun Spinner(modifier: Modifier) =
    CircularProgressIndicator(
        modifier.semantics { hideFromAccessibility() },
        color = LocalContentColor.current,
        strokeWidth = 2.dp,
    )
