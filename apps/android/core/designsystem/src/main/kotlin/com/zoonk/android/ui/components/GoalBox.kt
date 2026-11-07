package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
import java.util.Locale

/** The same limit core applies to a typed goal. */
const val MAX_GOAL_LENGTH = 2000

/**
 * Main's goal box (the landing's and `/start`'s): "I want to …" and Build my plan in one panel.
 * [onSubmit] gets the trimmed words; an empty box asks for them unless [canSubmitEmpty] (material and
 * an intent are already chosen). [leading] holds the attach button; [placeholder] is a page's own
 * example, as the catalog's is. [hiddenLabel] makes it main's buddy box: no visible "I want to" (TalkBack reads
 * the hidden label), and Build my plan beside the words while it fits. Enter sends, as main's box does.
 */
@Composable
fun GoalBox(
    value: String,
    onValueChange: (String) -> Unit,
    onSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
    note: String? = null,
    canSubmitEmpty: Boolean = false,
    isSubmitting: Boolean = false,
    focusRequester: FocusRequester = remember { FocusRequester() },
    leading: (@Composable () -> Unit)? = null,
    placeholder: String? = null,
    hiddenLabel: String? = null,
) {
    var isAskingForWords by rememberSaveable { mutableStateOf(false) }

    val submit: () -> Unit = {
        val goal = value.trim()

        when {
            isSubmitting -> {}

            goal.isNotEmpty() || canSubmitEmpty -> {
                onSubmit(goal)
            }

            else -> {
                isAskingForWords = true
                focusRequester.requestFocus()
            }
        }
    }

    val line = if (isAskingForWords) stringResource(R.string.goal_box_write_first) else note
    val label = hiddenLabel ?: stringResource(R.string.goal_box_label)
    val colors = MaterialTheme.colorScheme
    val words = MaterialTheme.zoonkType.lead.copy(color = colors.onSurface, lineHeight = GOAL_LINE_HEIGHT)
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val ring = if (LocalMoreContrast.current) 3.dp else 2.dp
    val shape = RoundedCornerShape(ZoonkRadius.xl)

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(
            Modifier
                .fillMaxWidth()
                .background(colors.surfaceContainerLow, shape)
                .border(if (focused) ring else 1.dp, if (focused) colors.primary else colors.outline, shape)
                .padding(6.dp),
        ) {
            val textField: @Composable () -> Unit = {
                BasicTextField(
                    value = value,
                    onValueChange = { typed ->
                        isAskingForWords = false
                        // A typed Enter sends; pasted lines join into one goal.
                        if (typed.length == value.length + 1 && typed.endsWith('\n')) {
                            submit()
                        } else {
                            onValueChange(typed.replace('\n', ' ').take(MAX_GOAL_LENGTH))
                        }
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester)
                            .semantics {
                                contentDescription = label
                                if (isAskingForWords) line?.let { error(it) }
                            },
                    readOnly = isSubmitting,
                    textStyle = words,
                    cursorBrush = SolidColor(colors.primary),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    maxLines = 8,
                    interactionSource = interaction,
                    decorationBox = { field ->
                        Box(Modifier.heightIn(min = 44.dp).padding(vertical = WORDS_PADDING)) {
                            if (value.isEmpty()) {
                                Text(
                                    placeholder ?: stringResource(R.string.goal_box_placeholder, spokenLanguage(currentLocale())),
                                    color = colors.onSurfaceVariant,
                                    style = words,
                                )
                            }
                            field()
                        }
                    },
                )
            }

            val submitButton: @Composable () -> Unit = {
                Button(
                    onClick = submit,
                    busy = isSubmitting,
                    trailingIcon = { ButtonIcon(R.drawable.ic_arrow_forward) },
                    size = ButtonSize.Large,
                ) {
                    Text(stringResource(R.string.goal_box_submit))
                }
            }

            if (hiddenLabel == null) {
                LabelBeside(
                    label = {
                        Text(
                            label,
                            Modifier
                                .clearAndSetSemantics {}
                                .clickable(interactionSource = null, indication = null) { focusRequester.requestFocus() }
                                .padding(vertical = WORDS_PADDING),
                            style = words.copy(fontWeight = FontWeight.Medium),
                        )
                    },
                    modifier = Modifier.padding(start = 10.dp, end = 10.dp),
                    field = textField,
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    CompositionLocalProvider(LocalContentColor provides colors.onSurfaceVariant) { leading?.invoke() }
                    Spacer(Modifier.weight(1f))
                    submitButton()
                }
            } else {
                ActionBeside(
                    field = textField,
                    action = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CompositionLocalProvider(LocalContentColor provides colors.onSurfaceVariant) { leading?.invoke() }
                            submitButton()
                        }
                    },
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
        }

        line?.let {
            Text(
                it,
                modifier = Modifier.padding(horizontal = 16.dp),
                color = if (isAskingForWords) colors.error else colors.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

/**
 * "I want to" before the words, as main's box reads; over them once it would take more than
 * [INLINE_LABEL_SHARE] of the line (a large font, a long label), so the words keep room to wrap.
 */
@Composable
private fun LabelBeside(
    label: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    field: @Composable () -> Unit,
) {
    Layout(contents = listOf(label, field), modifier = modifier) { (labels, fields), constraints ->
        val gap = LABEL_GAP.roundToPx()
        val width = constraints.maxWidth
        val labelPlaceable = labels.first().measure(constraints.copy(minWidth = 0, minHeight = 0))
        val beside = labelPlaceable.width + gap <= width * INLINE_LABEL_SHARE
        val fieldWidth = if (beside) width - labelPlaceable.width - gap else width
        val fieldPlaceable = fields.first().measure(constraints.copy(minWidth = fieldWidth, maxWidth = fieldWidth, minHeight = 0))
        // Stacked, the field's own top padding is the gap under the label.
        val fieldTop = if (beside) 0 else labelPlaceable.height - WORDS_PADDING.roundToPx()

        layout(width, maxOf(labelPlaceable.height, fieldTop + fieldPlaceable.height)) {
            labelPlaceable.placeRelative(0, 0)
            fieldPlaceable.placeRelative(if (beside) labelPlaceable.width + gap else 0, fieldTop)
        }
    }
}

/**
 * The buddy box's Build my plan at the end of the words' line, level with their last line, as main's; under them
 * at the end once it would take more than [ACTION_SHARE] of the line (a large font, a narrow window, a long
 * translation), so the words keep room to wrap.
 */
@Composable
private fun ActionBeside(
    field: @Composable () -> Unit,
    action: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    Layout(contents = listOf(field, action), modifier = modifier) { (fields, actions), constraints ->
        val width = constraints.maxWidth
        val gap = LABEL_GAP.roundToPx()
        val actionPlaceable = actions.first().measure(constraints.copy(minWidth = 0, minHeight = 0))
        val beside = actionPlaceable.width + gap <= width * ACTION_SHARE
        val fieldWidth = if (beside) width - actionPlaceable.width - gap else width - WORDS_END.roundToPx()
        val fieldPlaceable = fields.first().measure(constraints.copy(minWidth = fieldWidth, maxWidth = fieldWidth, minHeight = 0))
        val height = if (beside) maxOf(fieldPlaceable.height, actionPlaceable.height) else fieldPlaceable.height + actionPlaceable.height

        layout(width, height) {
            fieldPlaceable.placeRelative(0, if (beside) height - fieldPlaceable.height else 0)
            actionPlaceable.placeRelative(width - actionPlaceable.width, height - actionPlaceable.height)
        }
    }
}

data class GoalExample(
    val label: String,
    val kind: String,
)

/** Main's examples under the goal box: a tap sends the example as the goal. */
@Composable
fun GoalExamples(
    examples: List<GoalExample>,
    onPick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        SectionHeader(stringResource(R.string.goal_box_examples))
        Spacer(Modifier.size(8.dp))
        val pickLabel = stringResource(R.string.goal_box_example_pick)
        examples.forEachIndexed { index, example ->
            if (index > 0) HorizontalDivider()
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable(role = Role.Button, onClickLabel = pickLabel) { onPick(example.label) }
                        .padding(vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Main's `ListRowTitle` over its `ListRowDescription`.
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(example.label, style = MaterialTheme.typography.titleSmall)
                    Text(example.kind, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                Icon(
                    painterResource(R.drawable.ic_chevron_right),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Main's five examples, with the local exam and a language that isn't the app's own. */
@Composable
fun rememberGoalExamples(): List<GoalExample> {
    val locale = currentLocale()
    val language = spokenLanguage(locale)
    val quickExplanation = stringResource(R.string.goal_box_kind_quick_explanation, formatMinutes(QUICK_EXPLANATION_MINUTES, locale))

    return listOf(
        GoalExample(stringResource(R.string.goal_box_example_exam), stringResource(R.string.goal_box_kind_exam)),
        GoalExample(stringResource(R.string.goal_box_example_language, language), stringResource(R.string.goal_box_kind_language)),
        GoalExample(stringResource(R.string.goal_box_example_topic), stringResource(R.string.goal_box_kind_topic)),
        GoalExample(stringResource(R.string.goal_box_example_music), stringResource(R.string.goal_box_kind_music)),
        GoalExample(stringResource(R.string.goal_box_example_explanation), quickExplanation),
    )
}

/** Mid-sentence, so the name keeps the language's own casing ("inglês", "Spanish"). */
private fun spokenLanguage(locale: Locale): String {
    val spoken = if (locale.language == "en") "es" else "en"
    return Locale.forLanguageTag(spoken).getDisplayLanguage(locale)
}

private const val QUICK_EXPLANATION_MINUTES = 5

/** Main's `text-[17px] leading-6 py-2.5`: one line of words is 44dp. */
private val GOAL_LINE_HEIGHT = 24.sp
private val WORDS_PADDING = 10.dp
private val LABEL_GAP = 8.dp
private val WORDS_END = 10.dp
private const val INLINE_LABEL_SHARE = 0.4f
private const val ACTION_SHARE = 0.5f
