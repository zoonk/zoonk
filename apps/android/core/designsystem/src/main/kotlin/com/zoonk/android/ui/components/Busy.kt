package com.zoonk.android.ui.components

import androidx.compose.foundation.Indication
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import com.zoonk.android.R

/*
 * Main's busy state, for every button in Buttons.kt and for rows. From the press until its work ends
 * (`busy`), a control shows a spinner in its icon's place, keeps its label and its colors, ignores
 * presses, and stays enabled underneath, so it keeps the focus a disabled one would drop. A button with
 * no icon covers its label with the spinner instead, so it never changes size. A disabled button that
 * is `focusableWhenDisabled`, as main's is while another button's request runs, keeps its focus the
 * same way but looks disabled and shows no spinner.
 */

/**
 * A row's tap, held as a button's is: ignored while [busy], or while disabled but [focusableWhenDisabled],
 * with the row keeping focus and reading as unavailable.
 */
fun Modifier.busyClickable(
    busy: Boolean,
    enabled: Boolean = true,
    focusableWhenDisabled: Boolean = false,
    onClickLabel: String? = null,
    onClick: () -> Unit,
): Modifier {
    val held = held(busy, enabled, focusableWhenDisabled)
    return clickable(enabled = enabled || held, onClickLabel = onClickLabel, role = Role.Button) { if (!held) onClick() }.busy(held)
}

/**
 * [busyClickable] for a row that draws its own [indication] from [interactionSource], such as inside its
 * highlight; [onLongClick] opens what the row offers besides its tap, such as a menu.
 */
fun Modifier.busyClickable(
    busy: Boolean,
    interactionSource: MutableInteractionSource?,
    indication: Indication?,
    enabled: Boolean = true,
    focusableWhenDisabled: Boolean = false,
    onLongClickLabel: String? = null,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
): Modifier {
    val held = held(busy, enabled, focusableWhenDisabled)
    return combinedClickable(
        interactionSource,
        indication,
        enabled = enabled || held,
        role = Role.Button,
        onLongClickLabel = onLongClickLabel,
        onLongClick = onLongClick?.let { { if (!held) it() } },
    ) { if (!held) onClick() }.busy(held)
}

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

/**
 * A button's words with [padding] around them and one glyph: an icon before them ([leadingIcon]) or the
 * forward chevron after them ([forward]), never both. While [busy], a spinner takes the glyph's place,
 * or covers the words without one.
 */
@Composable
internal fun ButtonContent(
    busy: Boolean,
    leadingIcon: (@Composable () -> Unit)?,
    forward: Boolean,
    iconSize: Dp,
    padding: PaddingValues,
    content: @Composable RowScope.() -> Unit,
) {
    require(leadingIcon == null || !forward) { "A button shows at most one glyph." }

    if (leadingIcon == null && !forward) {
        BusyContent(busy) { Row(Modifier.padding(padding), verticalAlignment = Alignment.CenterVertically, content = content) }
        return
    }

    // The words are weighted so they're measured after the glyph's spot, wrapping instead of taking it.
    Row(Modifier.padding(padding), verticalAlignment = Alignment.CenterVertically) {
        leadingIcon?.let {
            IconSlot(busy, iconSize, it)
            Spacer(Modifier.width(ButtonDefaults.IconSpacing))
        }
        Row(Modifier.weight(1f, fill = false), verticalAlignment = Alignment.CenterVertically, content = content)
        if (forward) {
            Spacer(Modifier.width(ButtonDefaults.IconSpacing))
            IconSlot(busy, iconSize) { ButtonIcon(R.drawable.ic_chevron_right) }
        }
    }
}

@Composable
private fun IconSlot(
    busy: Boolean,
    size: Dp,
    icon: @Composable () -> Unit,
) {
    Box(Modifier.size(size), propagateMinConstraints = true) { if (busy) Spinner(Modifier) else icon() }
}

@Composable
private fun Spinner(modifier: Modifier) =
    CircularProgressIndicator(
        modifier.semantics { hideFromAccessibility() },
        color = LocalContentColor.current,
        strokeWidth = 2.dp,
    )
