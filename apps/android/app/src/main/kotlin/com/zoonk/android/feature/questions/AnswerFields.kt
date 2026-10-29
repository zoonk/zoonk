package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.parseLocalizedNumber
import com.zoonk.android.ui.theme.withTabularFigures
import java.util.Locale

/** A typed or numeric answer once checked; the field shows only whether it was right. */
enum class AnswerMark { Correct, Wrong }

/**
 * A math problem's answer box (main's `NumericAnswerField`): the number in the learner's own way
 * of writing it, decimal comma included, its unit beside it and the entry's rule under it. The host
 * gets the number as it's typed, null while it isn't one; Done sends it, or says what to type.
 */
@Composable
fun NumericAnswerField(
    entry: NumericEntry?,
    unit: NumericUnit?,
    mark: AnswerMark?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    onSubmit: (Answer) -> Unit,
    modifier: Modifier = Modifier,
    initialText: String = "",
) {
    val locale = currentLocale()
    var text by rememberSaveable { mutableStateOf(initialText) }
    var invalid by rememberSaveable { mutableStateOf(false) }
    val locked = !enabled || mark != null

    fun submit() {
        if (locked) return
        val value = parseEntryAnswer(entry, text, locale)
        if (value == null) invalid = true else onSubmit(Answer.Numeric(value))
    }

    OutlinedTextField(
        value = text,
        onValueChange = {
            text = it
            invalid = false
            onAnswer(parseEntryAnswer(entry, it, locale)?.let(Answer::Numeric))
        },
        modifier = modifier.fillMaxWidth(),
        readOnly = locked,
        textStyle = MaterialTheme.typography.titleLarge.withTabularFigures(),
        label = { Text(stringResource(R.string.questions_your_answer)) },
        // Material shows a prefix or suffix only once the label floats; a unit stays in view, as on main.
        leadingIcon =
            unit
                ?.takeIf {
                    it.position == NumericUnit.Position.Prefix
                }?.let { { Text(it.symbol, style = MaterialTheme.typography.bodyLarge) } },
        trailingIcon =
            unit?.takeIf { it.position == NumericUnit.Position.Suffix }.let { suffix ->
                if (suffix == null && mark == null) return@let null
                {
                    Row(
                        Modifier.padding(end = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        suffix?.let { Text(it.symbol, style = MaterialTheme.typography.bodyLarge) }
                        mark?.let { MarkIcon(it) }
                    }
                }
            },
        supportingText =
            when {
                invalid -> ({ Text(invalidHint(entry, locale), Modifier.semantics { liveRegion = LiveRegionMode.Polite }) })
                entry != null && entry.kind != NumericEntry.Kind.Number -> ({ Text(entryRule(entry)) })
                else -> null
            },
        isError = invalid,
        keyboardOptions =
            KeyboardOptions(
                // A phone's number pad has no slash, so a fraction box opens the full keyboard.
                keyboardType = if (entry?.kind == NumericEntry.Kind.Fraction) KeyboardType.Text else KeyboardType.Decimal,
                imeAction = ImeAction.Done,
                autoCorrectEnabled = false,
            ),
        keyboardActions = KeyboardActions(onDone = { submit() }),
        singleLine = true,
        colors = markColors(mark),
    )
}

/** A short typed answer, a word or a term (main's `TypedAnswerField`); Done sends it. */
@Composable
fun TypedAnswerField(
    mark: AnswerMark?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    onSubmit: (Answer) -> Unit,
    modifier: Modifier = Modifier,
    initialText: String = "",
) {
    var text by rememberSaveable { mutableStateOf(initialText) }
    val locked = !enabled || mark != null

    OutlinedTextField(
        value = text,
        onValueChange = {
            text = it.take(MAX_TYPED_ANSWER)
            onAnswer(text.trim().takeIf(String::isNotEmpty)?.let(Answer::Text))
        },
        modifier = modifier.fillMaxWidth(),
        readOnly = locked,
        textStyle = MaterialTheme.typography.titleLarge,
        label = { Text(stringResource(R.string.questions_your_answer)) },
        trailingIcon = mark?.let { { MarkIcon(it) } },
        keyboardOptions =
            KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                imeAction = ImeAction.Done,
            ),
        keyboardActions =
            KeyboardActions(onDone = {
                val answer = text.trim()
                if (!locked && answer.isNotEmpty()) onSubmit(Answer.Text(answer))
            }),
        singleLine = true,
        colors = markColors(mark),
    )
}

/** A fraction box takes "2/3"; a whole-number box refuses decimals. */
fun parseEntryAnswer(
    entry: NumericEntry?,
    text: String,
    locale: Locale,
): Double? {
    if (entry?.kind == NumericEntry.Kind.Fraction && '/' in text) {
        val parts = text.trim().split('/')
        if (parts.size != 2) return null
        val numerator = parseLocalizedNumber(parts[0], locale) ?: return null
        val denominator = parseLocalizedNumber(parts[1], locale)?.takeIf { it != 0.0 } ?: return null
        return numerator / denominator
    }

    val value = parseLocalizedNumber(text, locale)
    return if (entry?.kind == NumericEntry.Kind.Integer && value != null && value % 1 != 0.0) null else value
}

@Composable
private fun MarkIcon(mark: AnswerMark) {
    Icon(
        painter = painterResource(if (mark == AnswerMark.Correct) R.drawable.ic_check else R.drawable.ic_close),
        contentDescription =
            stringResource(if (mark == AnswerMark.Correct) R.string.questions_mark_correct else R.string.questions_mark_wrong),
        tint = if (mark == AnswerMark.Correct) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.error,
    )
}

/** A checked field keeps its words readable and takes the result's line. */
@Composable
private fun markColors(mark: AnswerMark?): TextFieldColors {
    val line =
        when (mark) {
            AnswerMark.Correct -> MaterialTheme.colorScheme.tertiary
            AnswerMark.Wrong -> MaterialTheme.colorScheme.error
            null -> return OutlinedTextFieldDefaults.colors()
        }
    return OutlinedTextFieldDefaults.colors(focusedBorderColor = line, unfocusedBorderColor = line)
}

@Composable
private fun entryRule(entry: NumericEntry): String =
    when (entry.kind) {
        NumericEntry.Kind.Decimals -> pluralStringResource(R.plurals.questions_entry_decimals, entry.places ?: 0, entry.places ?: 0)
        NumericEntry.Kind.Fraction -> stringResource(R.string.questions_entry_fraction)
        NumericEntry.Kind.Integer -> stringResource(R.string.questions_entry_integer)
        NumericEntry.Kind.Number -> ""
    }

@Composable
private fun invalidHint(
    entry: NumericEntry?,
    locale: Locale,
): String {
    val example = formatNumber(DECIMAL_EXAMPLE, locale)
    return when (entry?.kind) {
        NumericEntry.Kind.Fraction -> stringResource(R.string.questions_invalid_fraction, example)
        NumericEntry.Kind.Integer -> stringResource(R.string.questions_invalid_integer)
        else -> stringResource(R.string.questions_invalid_number, example)
    }
}

/** The contract takes up to 500 characters. */
private const val MAX_TYPED_ANSWER = 500
private const val DECIMAL_EXAMPLE = 2.5
