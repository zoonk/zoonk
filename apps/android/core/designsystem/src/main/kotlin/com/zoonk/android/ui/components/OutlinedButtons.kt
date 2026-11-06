package com.zoonk.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonElevation
import androidx.compose.material3.IconButtonColors
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics

/*
 * Material draws outlined buttons' borders in `outlineVariant`, our hairline `border`, which nearly
 * vanishes in dark theme, and their labels in a muted grey. Main's outline buttons use `--input`,
 * our `outline`, with ink labels, so these take both.
 */

/** While [busy] it looks disabled and ignores presses, but keeps focus, so a learner who pressed it keeps their place. */
@Composable
fun OutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    shape: Shape = ButtonDefaults.outlinedShape,
    colors: ButtonColors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = outlinedBorder(enabled && !busy, ButtonDefaults.outlinedButtonBorder(enabled && !busy)),
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) = androidx.compose.material3.OutlinedButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.semantics { if (busy) disabled() },
    enabled = enabled || busy,
    shape = shape,
    colors = if (busy) colors.copy(containerColor = colors.disabledContainerColor, contentColor = colors.disabledContentColor) else colors,
    elevation = elevation,
    border = border,
    contentPadding = contentPadding,
    interactionSource = interactionSource,
    content = content,
)

@Composable
fun OutlinedIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = IconButtonDefaults.outlinedShape,
    colors: IconButtonColors = IconButtonDefaults.outlinedIconButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
    border: BorderStroke? = outlinedBorder(enabled, IconButtonDefaults.outlinedIconButtonBorder(enabled)),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable () -> Unit,
) = androidx.compose.material3.OutlinedIconButton(
    onClick = onClick,
    modifier = modifier,
    enabled = enabled,
    shape = shape,
    colors = colors,
    border = border,
    interactionSource = interactionSource,
    content = content,
)

/** Material's width. Disabled, the outline dims to half, as main dims a disabled button. */
@Composable
private fun outlinedBorder(
    enabled: Boolean,
    material: BorderStroke,
): BorderStroke {
    val outline = MaterialTheme.colorScheme.outline
    return BorderStroke(material.width, if (enabled) outline else outline.copy(alpha = outline.alpha * DISABLED_ALPHA))
}

private const val DISABLED_ALPHA = 0.5f
