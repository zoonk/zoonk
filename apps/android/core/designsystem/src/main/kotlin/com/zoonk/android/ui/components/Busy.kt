package com.zoonk.android.ui.components

import androidx.compose.foundation.Indication
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButtonColors
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/*
 * Main's busy state, for every button in Buttons.kt and for rows. From the press until its work ends
 * (`busy`), a control ignores presses and takes its disabled colors but stays enabled underneath, so
 * it keeps the focus a disabled one would drop, and reads as unavailable. Once the wait turns slow
 * ([rememberSlowWait]), [BusyContent] covers its content with a spinner, so it never changes size;
 * the content is back the moment the work ends. A label stays as it was at rest. A button's content
 * padding goes inside [BusyRow], so the spinner centers on the whole button however that padding
 * leans. A disabled button that is `focusableWhenDisabled`, as main's is, keeps its focus the same
 * way, with no spinner.
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
 * [content] until a [busy] wait turns slow, then a spinner in its place at its size: a button's whole
 * content, or only a row's mark (its icon, chevron or time) so the row's words stay. The content is
 * left undrawn rather than transparent, which TalkBack would skip.
 */
@Composable
fun BusyContent(
    busy: Boolean,
    content: @Composable () -> Unit,
) = BusyBox(busy, NO_PADDING, content)

internal fun held(
    busy: Boolean,
    enabled: Boolean,
    focusableWhenDisabled: Boolean,
) = busy || (focusableWhenDisabled && !enabled)

internal fun Modifier.busy(busy: Boolean): Modifier = semantics { if (busy) disabled() }

internal fun ButtonColors.disabledWhen(busy: Boolean): ButtonColors =
    if (busy) copy(containerColor = disabledContainerColor, contentColor = disabledContentColor) else this

internal fun IconButtonColors.disabledWhen(busy: Boolean): IconButtonColors =
    if (busy) copy(containerColor = disabledContainerColor, contentColor = disabledContentColor) else this

@Composable
internal fun BusyRow(
    busy: Boolean,
    padding: PaddingValues,
    content: @Composable RowScope.() -> Unit,
) = BusyBox(busy, padding) { Row(verticalAlignment = Alignment.CenterVertically, content = content) }

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

internal val NO_PADDING = PaddingValues()
