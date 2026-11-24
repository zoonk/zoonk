package com.zoonk.android.ui.components

import android.annotation.SuppressLint
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.OutputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import kotlinx.coroutines.flow.drop

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
    state: TextFieldState,
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
    inputTransformation: InputTransformation? = null,
    outputTransformation: OutputTransformation? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    onKeyboardAction: KeyboardActionHandler? = null,
    lineLimits: TextFieldLineLimits = TextFieldLineLimits.Default,
    colors: TextFieldColors = OutlinedTextFieldDefaults.colors(),
    shape: Shape = FIELD_SHAPE,
    contentPadding: PaddingValues = FIELD_PADDING,
    interactionSource: MutableInteractionSource? = null,
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
    val materialDecorator =
        OutlinedTextFieldDefaults.decorator(
            state = state,
            enabled = enabled,
            lineLimits = lineLimits,
            outputTransformation = outputTransformation,
            interactionSource = interaction,
            placeholder = placeholder,
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            prefix = prefix,
            suffix = suffix,
            isError = isError,
            colors = colors,
            contentPadding = contentPadding,
            container = { FieldContainer(enabled, isError, interaction, colors, shape) },
        )
    CompositionLocalProvider(LocalTextSelectionColors provides colors.textSelectionColors) {
        BasicTextField(
            state = state,
            modifier = modifier.fieldSemantics(label, isError),
            enabled = enabled,
            readOnly = readOnly,
            textStyle = textStyle.merge(TextStyle(color = textColor)),
            cursorBrush = SolidColor(if (isError) colors.errorCursorColor else colors.cursorColor),
            interactionSource = interaction,
            lineLimits = lineLimits,
            inputTransformation = inputTransformation,
            outputTransformation = outputTransformation,
            keyboardOptions = keyboardOptions,
            onKeyboardAction = onKeyboardAction,
            decorator = { inner ->
                val supporting =
                    supportingText?.let { text ->
                        @Composable {
                            val color =
                                when {
                                    !enabled -> colors.disabledSupportingTextColor
                                    isError -> colors.errorSupportingTextColor
                                    focused -> colors.focusedSupportingTextColor
                                    else -> colors.unfocusedSupportingTextColor
                                }
                            CompositionLocalProvider(LocalContentColor provides color) {
                                ProvideTextStyle(MaterialTheme.typography.bodySmall, text)
                            }
                        }
                    }
                LabeledField(label, enabled, supporting) {
                    Box(Modifier.heightIn(min = FIELD_MIN_HEIGHT), propagateMinConstraints = true) {
                        with(materialDecorator) { Decoration(inner) }
                    }
                }
            },
        )
    }
}

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

/**
 * Main's `Label` over the field and its [supporting] line under it, both on the field's start edge: Material's own
 * supporting text starts 16dp inside the field. A minimum height the caller asks for goes to the field, not to them.
 */
@Composable
private fun LabeledField(
    label: String?,
    enabled: Boolean,
    supporting: (@Composable () -> Unit)?,
    field: @Composable () -> Unit,
) {
    if (label == null && supporting == null) {
        field()
        return
    }
    val color = MaterialTheme.colorScheme.onSurface
    Layout(
        contents =
            listOf(
                {
                    if (label != null) {
                        Text(
                            label,
                            color = if (enabled) color else color.copy(alpha = DISABLED_ALPHA),
                            style = MaterialTheme.typography.titleSmall,
                        )
                    }
                },
                field,
                { if (supporting != null) supporting() },
            ),
    ) { (labels, fields, supports), constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val labelPlaceable = labels.firstOrNull()?.measure(loose)
        val supportPlaceable = supports.firstOrNull()?.measure(loose)
        val above = labelPlaceable?.let { it.height + LABEL_GAP.roundToPx() } ?: 0
        val below = supportPlaceable?.let { it.height + SUPPORTING_GAP.roundToPx() } ?: 0
        val taken = above + below
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
        val width = maxOf(labelPlaceable?.width ?: 0, fieldPlaceable.width, supportPlaceable?.width ?: 0)
        layout(width, taken + fieldPlaceable.height) {
            labelPlaceable?.placeRelative(0, 0)
            fieldPlaceable.placeRelative(0, above)
            supportPlaceable?.placeRelative(0, above + fieldPlaceable.height + SUPPORTING_GAP.roundToPx())
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
    shape: Shape = FIELD_SHAPE,
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
        shape = shape,
        focusedBorderThickness = if (moreContrast) 3.dp else 2.dp,
        unfocusedBorderThickness = 1.dp,
    )
}

fun Modifier.submitOnEnter(
    state: TextFieldState,
    submit: () -> Unit,
): Modifier =
    onPreviewKeyEvent { event ->
        val sends = (event.key == Key.Enter || event.key == Key.NumPadEnter) && !event.isShiftPressed && state.composition == null
        if (sends && event.type == KeyEventType.KeyDown) submit()
        sends
    }

@Composable
fun TextFieldState.ObserveEdits(onEdit: (String) -> Unit) {
    val current by rememberUpdatedState(onEdit)
    LaunchedEffect(this) {
        snapshotFlow { text.toString() }.drop(1).collect { current(it) }
    }
}

@Composable
fun readOnlyFieldState(value: String): TextFieldState = remember(value) { TextFieldState(value) }

private val FIELD_SHAPE = RoundedCornerShape(ZoonkRadius.lg)

/**
 * Main's writing editor: a long answer's field keeps its soft `input` line while focused, since its
 * caret already shows where the learner is; more contrast still draws the ink ring.
 */
@Composable
fun writingAreaColors(): TextFieldColors =
    if (LocalMoreContrast.current) {
        OutlinedTextFieldDefaults.colors()
    } else {
        OutlinedTextFieldDefaults.colors(focusedBorderColor = MaterialTheme.colorScheme.outline)
    }

/** Main's `h-11 px-3`: 44dp on one line of 24sp text. */
private val FIELD_PADDING = PaddingValues(horizontal = 12.dp, vertical = 10.dp)

/** Main's `aria-invalid:ring-[3px]`, outside the field's line. */
private val INVALID_RING = 3.dp
private const val HALF = 0.5f

private val LABEL_GAP = 8.dp

private val FIELD_MIN_HEIGHT = 48.dp

/** Material's gap over a field's supporting text. */
private val SUPPORTING_GAP = 4.dp
private const val DISABLED_ALPHA = 0.38f
