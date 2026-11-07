package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonElevation
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonColors
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk

/*
 * Main's buttons, one look per role: the main action filled with ink, a secondary one see-through with
 * an `input` line and ink words, main's `secondary` variant with ink words on a quiet fill, a quiet one
 * with words alone, and a destructive one in pink-red words on its tint. All take main's `rounded-lg` (`rounded-md` when small) instead of Material's pill, and no
 * shadow. Material's own buttons are reported by the `MaterialButton` lint check outside this file.
 * Every size keeps Material's 48dp touch target.
 *
 * Every one is `busy` while its own work runs, and a disabled one may stay `focusableWhenDisabled`, as main's do (Busy.kt).
 * A `leadingIcon`, or a `trailingIcon` for the forward arrow, is a [ButtonIcon], and a busy button's spinner takes its place.
 */

/** Main's sizes: [Large] (`lg`, 44dp) for a screen's action, [Small] (`sm`, 30dp) beside text, [Medium] elsewhere. */
enum class ButtonSize { Small, Medium, Large }

/** The size of the buttons inside, unless they pick one: an action bar makes its buttons [ButtonSize.Large]. */
val LocalButtonSize = staticCompositionLocalOf { ButtonSize.Medium }

/** A Material Symbol for a button's `leadingIcon` or `trailingIcon`, sized by its slot. */
@Composable
fun ButtonIcon(
    @DrawableRes id: Int,
) = Icon(painterResource(id), contentDescription = null)

@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    focusableWhenDisabled: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = size.shape(),
    colors: ButtonColors = mainButtonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = size.contentPadding(leadingIcon != null, trailingIcon != null),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val held = held(busy, enabled, focusableWhenDisabled)
    androidx.compose.material3.Button(
        onClick = { if (!held) onClick() },
        modifier = modifier.sized(size).busy(held),
        enabled = enabled || held,
        shape = shape,
        colors = colors.disabledWhen(held && !busy),
        elevation = elevation,
        border = border,
        contentPadding = NO_PADDING,
        interactionSource = interactionSource,
        content = { Labeled(size) { ButtonContent(busy, leadingIcon, trailingIcon, size.iconSize(), contentPadding, content) } },
    )
}

/** Main's `secondary` button: ink words on a quiet fill, as main draws the lesson's "I don't know yet" in place of Check. */
@Composable
fun SecondaryButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    focusableWhenDisabled: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    size: ButtonSize = LocalButtonSize.current,
    contentPadding: PaddingValues = size.contentPadding(leadingIcon != null, trailingIcon != null),
    content: @Composable RowScope.() -> Unit,
) {
    val fill = MaterialTheme.zoonk.secondary
    val words = MaterialTheme.colorScheme.onSurface
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        busy = busy,
        focusableWhenDisabled = focusableWhenDisabled,
        leadingIcon = leadingIcon,
        trailingIcon = trailingIcon,
        size = size,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = fill,
                contentColor = words,
                disabledContainerColor = fill.copy(alpha = fill.alpha * DISABLED_ALPHA),
                disabledContentColor = words.copy(alpha = DISABLED_ALPHA),
            ),
        contentPadding = contentPadding,
        content = content,
    )
}

/**
 * Main's `destructive` button: pink-red words on their tint, for an action that removes something.
 * A dialog's confirmation stays Material's `TextButton` in `error`.
 */
@Composable
fun DestructiveButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    focusableWhenDisabled: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    size: ButtonSize = LocalButtonSize.current,
    contentPadding: PaddingValues = size.contentPadding(leadingIcon != null, trailingIcon != null),
    content: @Composable RowScope.() -> Unit,
) {
    val words = MaterialTheme.colorScheme.error
    val tint = MaterialTheme.colorScheme.errorContainer
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        busy = busy,
        focusableWhenDisabled = focusableWhenDisabled,
        leadingIcon = leadingIcon,
        trailingIcon = trailingIcon,
        size = size,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = tint,
                contentColor = words,
                disabledContainerColor = tint.copy(alpha = tint.alpha * DISABLED_ALPHA),
                disabledContentColor = words.copy(alpha = DISABLED_ALPHA),
            ),
        contentPadding = contentPadding,
        content = content,
    )
}

/**
 * Material draws outlined buttons' borders in `outlineVariant`, our hairline `border`, which nearly
 * vanishes in dark theme, and their labels in a muted grey. Main's outline buttons use `--input`,
 * our `outline`, with ink labels, so these take both.
 */
@Composable
fun OutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    focusableWhenDisabled: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = size.shape(),
    colors: ButtonColors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = outlinedBorder(enabled || busy, ButtonDefaults.outlinedButtonBorder(enabled || busy)),
    contentPadding: PaddingValues = size.contentPadding(leadingIcon != null, trailingIcon != null),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val held = held(busy, enabled, focusableWhenDisabled)
    androidx.compose.material3.OutlinedButton(
        onClick = { if (!held) onClick() },
        modifier = modifier.sized(size).busy(held),
        enabled = enabled || held,
        shape = shape,
        colors = colors.disabledWhen(held && !busy),
        elevation = elevation,
        border = border,
        contentPadding = NO_PADDING,
        interactionSource = interactionSource,
        content = { Labeled(size) { ButtonContent(busy, leadingIcon, trailingIcon, size.iconSize(), contentPadding, content) } },
    )
}

/** Main's `ghost` button: ink words, no line. */
@Composable
fun TextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    focusableWhenDisabled: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = size.shape(),
    colors: ButtonColors = ButtonDefaults.textButtonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = size.contentPadding(leadingIcon != null, trailingIcon != null),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val held = held(busy, enabled, focusableWhenDisabled)
    androidx.compose.material3.TextButton(
        onClick = { if (!held) onClick() },
        modifier = modifier.sized(size).busy(held),
        enabled = enabled || held,
        shape = shape,
        colors = colors.disabledWhen(held && !busy),
        elevation = elevation,
        border = border,
        contentPadding = NO_PADDING,
        interactionSource = interactionSource,
        content = { Labeled(size) { ButtonContent(busy, leadingIcon, trailingIcon, size.iconSize(), contentPadding, content) } },
    )
}

/** Main's `size="icon"` outline button: `rounded-lg`, never a circle, as tall as a [ButtonSize.Large] action beside it. */
@Composable
fun OutlinedIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = RoundedCornerShape(ZoonkRadius.lg),
    colors: IconButtonColors = IconButtonDefaults.outlinedIconButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
    border: BorderStroke? = outlinedBorder(enabled || busy, IconButtonDefaults.outlinedIconButtonBorder(enabled || busy)),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable () -> Unit,
) = androidx.compose.material3.OutlinedIconButton(
    onClick = { if (!busy) onClick() },
    modifier = (if (size == ButtonSize.Large) modifier.size(44.dp) else modifier).busy(busy),
    enabled = enabled || busy,
    shape = shape,
    colors = colors,
    border = border,
    interactionSource = interactionSource,
    content = { BusyContent(busy, content) },
)

/** Material's filled icon button, which can be [busy] as the others are: a composer's send. */
@Composable
fun FilledIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    shape: Shape = IconButtonDefaults.filledShape,
    colors: IconButtonColors = IconButtonDefaults.filledIconButtonColors(),
    content: @Composable () -> Unit,
) = androidx.compose.material3.FilledIconButton(
    onClick = { if (!busy) onClick() },
    modifier = modifier.busy(busy),
    enabled = enabled || busy,
    shape = shape,
    colors = colors,
    content = { BusyContent(busy, content) },
)

/** Main's disabled main action: `muted` with its words in `muted-foreground`, not Material's translucent ink. */
@Composable
private fun mainButtonColors(): ButtonColors =
    ButtonDefaults.buttonColors(
        disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
    )

private fun ButtonSize.shape(): Shape = RoundedCornerShape(if (this == ButtonSize.Small) ZoonkRadius.md else ZoonkRadius.lg)

/** An icon brings its side in a little, as main's `has-data-[icon=inline-start]` and `inline-end` do. */
private fun ButtonSize.contentPadding(
    leadingIcon: Boolean,
    trailingIcon: Boolean,
): PaddingValues {
    val (side, iconSide, vertical) = if (this == ButtonSize.Small) Triple(10.dp, 8.dp, 4.dp) else Triple(16.dp, 12.dp, 8.dp)
    return PaddingValues(
        start = if (leadingIcon) iconSide else side,
        top = vertical,
        end = if (trailingIcon) iconSide else side,
        bottom = vertical,
    )
}

private fun ButtonSize.iconSize(): Dp = if (this == ButtonSize.Small) 16.dp else ButtonDefaults.IconSize

// A minimum height overrides Material's 40dp; it grows with the words at larger font sizes.
private fun Modifier.sized(size: ButtonSize): Modifier =
    when (size) {
        ButtonSize.Small -> heightIn(min = 30.dp)
        ButtonSize.Medium -> this
        ButtonSize.Large -> heightIn(min = 44.dp)
    }

/** Material writes every button's words in `labelLarge`; a small one takes main's 13sp. */
@Composable
private fun Labeled(
    size: ButtonSize,
    content: @Composable () -> Unit,
) {
    if (size == ButtonSize.Small) ProvideTextStyle(MaterialTheme.typography.labelMedium, content) else content()
}

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

private val NO_PADDING = PaddingValues()
