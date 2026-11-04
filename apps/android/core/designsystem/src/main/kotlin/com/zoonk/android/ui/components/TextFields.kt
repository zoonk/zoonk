package com.zoonk.android.ui.components

import android.annotation.SuppressLint
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.TextFieldLabelPosition
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk

/*
 * Main's field (`Input`, `Textarea` under a `Label`): the label above the field, never floating inside
 * it, a 1dp `input` line with `rounded-lg` corners, 44dp tall on one line, and an ink ring while
 * focused (thicker with more contrast): Material's outlined colors already draw the line in `outline`
 * (`input`) and the ring in `primary` (ink). An invalid field draws main's `destructive` mark with its
 * soft 3dp ring, while its message keeps Material's `error` (`destructive-text`) words. Built as Material builds its own outlined field, from
 * `BasicTextField` and Material's decoration and container, so IME, autofill, selection, supporting
 * text and TalkBack behave as Material's; the label is part of the field, so TalkBack reads it as the
 * field's label and a tap on it focuses the field. Material's own fields are reported by the
 * `MaterialTextField` lint check outside this file.
 */

@Composable
fun OutlinedTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    textStyle: TextStyle = LocalTextStyle.current,
    label: String? = null,
    placeholder: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    prefix: @Composable (() -> Unit)? = null,
    suffix: @Composable (() -> Unit)? = null,
    supportingText: @Composable (() -> Unit)? = null,
    isError: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = false,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    minLines: Int = 1,
    interactionSource: MutableInteractionSource? = null,
    colors: TextFieldColors = OutlinedTextFieldDefaults.colors(),
) {
    val interaction = interactionSource ?: remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val textColor =
        textStyle.color.takeOrElse {
            when {
                !enabled -> colors.disabledTextColor
                isError -> colors.errorTextColor
                focused -> colors.focusedTextColor
                else -> colors.unfocusedTextColor
            }
        }

    CompositionLocalProvider(LocalTextSelectionColors provides colors.textSelectionColors) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = modifier.fieldSemantics(label, isError),
            enabled = enabled,
            readOnly = readOnly,
            textStyle = textStyle.merge(TextStyle(color = textColor)),
            cursorBrush = SolidColor(if (isError) colors.errorCursorColor else colors.cursorColor),
            visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            interactionSource = interaction,
            singleLine = singleLine,
            maxLines = maxLines,
            minLines = minLines,
            decorationBox = { innerTextField ->
                LabeledField(label, enabled) {
                    OutlinedTextFieldDefaults.DecorationBox(
                        value = value,
                        innerTextField = innerTextField,
                        enabled = enabled,
                        singleLine = singleLine,
                        visualTransformation = visualTransformation,
                        interactionSource = interaction,
                        isError = isError,
                        placeholder = placeholder,
                        leadingIcon = leadingIcon,
                        trailingIcon = trailingIcon,
                        prefix = prefix,
                        suffix = suffix,
                        supportingText = supportingText,
                        colors = colors,
                        contentPadding = FIELD_PADDING,
                        container = { FieldContainer(enabled, isError, interaction, colors) },
                    )
                }
            },
        )
    }
}

/** A field over a [TextFieldState], such as a composer that limits its length; Material's label sits above it. */
@Composable
fun OutlinedTextField(
    state: TextFieldState,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    textStyle: TextStyle = LocalTextStyle.current,
    label: String? = null,
    placeholder: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    supportingText: @Composable (() -> Unit)? = null,
    isError: Boolean = false,
    inputTransformation: InputTransformation? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    onKeyboardAction: KeyboardActionHandler? = null,
    lineLimits: TextFieldLineLimits = TextFieldLineLimits.Default,
    interactionSource: MutableInteractionSource? = null,
) = androidx.compose.material3.OutlinedTextField(
    state = state,
    modifier = modifier.minimumInteractiveComponentSize(),
    enabled = enabled,
    readOnly = readOnly,
    textStyle = textStyle,
    labelPosition = TextFieldLabelPosition.Above(),
    label = label?.let { { Text(it) } },
    placeholder = placeholder,
    leadingIcon = leadingIcon,
    trailingIcon = trailingIcon,
    supportingText = supportingText,
    isError = isError,
    inputTransformation = inputTransformation,
    keyboardOptions = keyboardOptions,
    onKeyboardAction = onKeyboardAction,
    lineLimits = lineLimits,
    shape = FIELD_SHAPE,
    colors = OutlinedTextFieldDefaults.colors(),
    contentPadding = FIELD_PADDING,
    interactionSource = interactionSource,
)

/**
 * Material's field semantics: its words merged into one node with the label, and an error TalkBack
 * announces as Material's does, in Compose's own words for it.
 */
@SuppressLint("PrivateResource")
@Composable
private fun Modifier.fieldSemantics(
    label: String?,
    isError: Boolean,
): Modifier {
    // The same text Material's `OutlinedTextField` gives an invalid field, translated by Compose.
    val invalid = stringResource(androidx.compose.ui.R.string.default_error_message)
    return then(if (label != null) Modifier.semantics(mergeDescendants = true) {} else Modifier)
        .semantics { if (isError) error(invalid) }
        .minimumInteractiveComponentSize()
}

/** Main's `Label` over the field; a minimum height the caller asks for goes to the field, not the label. */
@Composable
private fun LabeledField(
    label: String?,
    enabled: Boolean,
    field: @Composable () -> Unit,
) {
    if (label == null) {
        field()
        return
    }
    val color = MaterialTheme.colorScheme.onSurface
    Layout(
        contents =
            listOf(
                {
                    Text(
                        label,
                        color = if (enabled) color else color.copy(alpha = DISABLED_ALPHA),
                        style = MaterialTheme.typography.titleSmall,
                    )
                },
                field,
            ),
    ) { (labels, fields), constraints ->
        val gap = LABEL_GAP.roundToPx()
        val labelPlaceable = labels.first().measure(constraints.copy(minWidth = 0, minHeight = 0))
        val taken = labelPlaceable.height + gap
        val fieldPlaceable =
            fields.first().measure(
                constraints.copy(
                    minHeight = (constraints.minHeight - taken).coerceAtLeast(0),
                    maxHeight =
                        if (constraints.hasBoundedHeight) {
                            (constraints.maxHeight - taken).coerceAtLeast(
                                0,
                            )
                        } else {
                            Constraints.Infinity
                        },
                ),
            )
        layout(maxOf(labelPlaceable.width, fieldPlaceable.width), taken + fieldPlaceable.height) {
            labelPlaceable.placeRelative(0, 0)
            fieldPlaceable.placeRelative(0, taken)
        }
    }
}

/**
 * A 1dp `input` line; focused, an ink ring of 2dp, 3dp with more contrast (main's `contrast-more:`
 * focus). Invalid, main's `aria-invalid:` look: the line in `destructive` (half strength in dark) with
 * a 3dp ring of it outside (20%, 40% in dark), both solid with more contrast.
 */
@Composable
private fun FieldContainer(
    enabled: Boolean,
    isError: Boolean,
    interactionSource: MutableInteractionSource,
    colors: TextFieldColors,
) {
    val moreContrast = LocalMoreContrast.current
    val dark = MaterialTheme.colorScheme.background.luminance() < HALF
    val mark = MaterialTheme.zoonk.destructive
    val line = if (dark && !moreContrast) mark.copy(alpha = 0.5f) else mark
    val ring = if (moreContrast) Color.Transparent else mark.copy(alpha = if (dark) 0.4f else 0.2f)
    val radius = with(LocalDensity.current) { ZoonkRadius.lg.toPx() }

    OutlinedTextFieldDefaults.Container(
        enabled = enabled,
        isError = isError,
        interactionSource = interactionSource,
        modifier =
            if (isError && enabled) {
                Modifier.drawBehind {
                    val width = INVALID_RING.toPx()
                    drawRoundRect(
                        color = ring,
                        topLeft = Offset(-width / 2, -width / 2),
                        size = Size(size.width + width, size.height + width),
                        cornerRadius = CornerRadius(radius + width / 2),
                        style = Stroke(width),
                    )
                }
            } else {
                Modifier
            },
        colors = colors.copy(errorIndicatorColor = line),
        shape = FIELD_SHAPE,
        focusedBorderThickness = if (moreContrast) 3.dp else 2.dp,
        unfocusedBorderThickness = 1.dp,
    )
}

private val FIELD_SHAPE = RoundedCornerShape(ZoonkRadius.lg)

/** Main's `h-11 px-3`: 44dp on one line of 24sp text. */
private val FIELD_PADDING = PaddingValues(horizontal = 12.dp, vertical = 10.dp)

/** Main's `aria-invalid:ring-[3px]`, outside the field's line. */
private val INVALID_RING = 3.dp
private const val HALF = 0.5f

private val LABEL_GAP = 8.dp
private const val DISABLED_ALPHA = 0.38f
