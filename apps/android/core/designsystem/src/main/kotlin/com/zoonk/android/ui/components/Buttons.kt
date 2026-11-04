package com.zoonk.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonElevation
import androidx.compose.material3.IconButtonColors
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkRadius

/*
 * Main's buttons, one look per role: the main action filled with ink, a secondary one see-through with
 * an `input` line and ink words, a quiet one with words alone, and a destructive one in pink-red words
 * on its tint. All take main's `rounded-lg` (`rounded-md` when small) instead of Material's pill, and no
 * shadow. Material's own buttons are reported by the `MaterialButton` lint check outside this file.
 * Every size keeps Material's 48dp touch target.
 */

/** Main's sizes: [Large] (`lg`, 44dp) for a screen's action, [Small] (`sm`, 30dp) beside text, [Medium] elsewhere. */
enum class ButtonSize { Small, Medium, Large }

/** The size of the buttons inside, unless they pick one: an action bar makes its buttons [ButtonSize.Large]. */
val LocalButtonSize = staticCompositionLocalOf { ButtonSize.Medium }

@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = size.shape(),
    colors: ButtonColors = mainButtonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = size.contentPadding(),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) = androidx.compose.material3.Button(
    onClick = onClick,
    modifier = modifier.sized(size),
    enabled = enabled,
    shape = shape,
    colors = colors,
    elevation = elevation,
    border = border,
    contentPadding = contentPadding,
    interactionSource = interactionSource,
    content = { Labeled(size) { content() } },
)

/**
 * Main's `destructive` button: pink-red words on their tint, for an action that removes something.
 * A dialog's confirmation stays Material's `TextButton` in `error`.
 */
@Composable
fun DestructiveButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: ButtonSize = LocalButtonSize.current,
    contentPadding: PaddingValues = size.contentPadding(),
    content: @Composable RowScope.() -> Unit,
) {
    val words = MaterialTheme.colorScheme.error
    val tint = MaterialTheme.colorScheme.errorContainer
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
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
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = size.shape(),
    colors: ButtonColors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = outlinedBorder(enabled, ButtonDefaults.outlinedButtonBorder(enabled)),
    contentPadding: PaddingValues = size.contentPadding(),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) = androidx.compose.material3.OutlinedButton(
    onClick = onClick,
    modifier = modifier.sized(size),
    enabled = enabled,
    shape = shape,
    colors = colors,
    elevation = elevation,
    border = border,
    contentPadding = contentPadding,
    interactionSource = interactionSource,
    content = { Labeled(size) { content() } },
)

/** Main's `ghost` button: ink words, no line. */
@Composable
fun TextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: ButtonSize = LocalButtonSize.current,
    shape: Shape = size.shape(),
    colors: ButtonColors = ButtonDefaults.textButtonColors(),
    elevation: ButtonElevation? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = size.contentPadding(),
    interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit,
) = androidx.compose.material3.TextButton(
    onClick = onClick,
    modifier = modifier.sized(size),
    enabled = enabled,
    shape = shape,
    colors = colors,
    elevation = elevation,
    border = border,
    contentPadding = contentPadding,
    interactionSource = interactionSource,
    content = { Labeled(size) { content() } },
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

/** Main's disabled main action: `muted` with its words in `muted-foreground`, not Material's translucent ink. */
@Composable
private fun mainButtonColors(): ButtonColors =
    ButtonDefaults.buttonColors(
        disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
    )

private fun ButtonSize.shape(): Shape = RoundedCornerShape(if (this == ButtonSize.Small) ZoonkRadius.md else ZoonkRadius.lg)

private fun ButtonSize.contentPadding(): PaddingValues =
    when (this) {
        ButtonSize.Small -> PaddingValues(horizontal = 10.dp, vertical = 4.dp)
        ButtonSize.Medium, ButtonSize.Large -> PaddingValues(horizontal = 16.dp, vertical = 8.dp)
    }

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
