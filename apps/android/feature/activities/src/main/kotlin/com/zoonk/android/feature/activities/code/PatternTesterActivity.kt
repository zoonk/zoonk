package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import kotlinx.coroutines.flow.drop
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf19Value as PatternTesterContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19Fields.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOf1Value as FormulaFieldsValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19Fields.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOfValue as RegexFieldsValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOf as RegexFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOf1 as FormulaFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOfHintsInner as PatternHint

val patternTesterRenderer =
    ActivityRenderer(
        badge = { null },
        canvas = { PatternTesterActivity(it) },
    )

@Composable
private fun regexSnippets() =
    listOf(
        CodeSnippet("^", stringResource(R.string.activities_code_snippet_start), "^"),
        CodeSnippet("$", stringResource(R.string.activities_code_snippet_end), "$"),
        CodeSnippet("\\d", stringResource(R.string.activities_code_snippet_digit), "\\d"),
        CodeSnippet("\\w", stringResource(R.string.activities_code_snippet_word), "\\w"),
        CodeSnippet("\\s", stringResource(R.string.activities_code_snippet_space), "\\s"),
        CodeSnippet(".", stringResource(R.string.activities_code_snippet_any), "."),
        CodeSnippet("[ ]", stringResource(R.string.activities_code_snippet_one_of), "[", "]"),
        CodeSnippet("{ }", stringResource(R.string.activities_code_snippet_repeat), "{", "}"),
        CodeSnippet("( )", stringResource(R.string.activities_code_snippet_group), "(", ")"),
        CodeSnippet("?", stringResource(R.string.activities_code_snippet_optional), "?"),
        CodeSnippet("+", stringResource(R.string.activities_code_snippet_one_or_more), "+"),
        CodeSnippet("*", stringResource(R.string.activities_code_snippet_zero_or_more), "*"),
        CodeSnippet("|", stringResource(R.string.activities_code_snippet_or), "|"),
    )

@Composable
private fun formulaSnippets(fields: FormulaFields) =
    fields.examples
        .firstOrNull()
        ?.inputs
        .orEmpty()
        .map { CodeSnippet(it.name, it.name, it.name) } +
        listOf(
            CodeSnippet("+", stringResource(R.string.activities_code_snippet_plus), "+"),
            CodeSnippet("−", stringResource(R.string.activities_code_snippet_minus), "-"),
            CodeSnippet("×", stringResource(R.string.activities_code_snippet_times), "*"),
            CodeSnippet("÷", stringResource(R.string.activities_code_snippet_divided_by), "/"),
            CodeSnippet("^", stringResource(R.string.activities_code_snippet_power), "^"),
            CodeSnippet("( )", stringResource(R.string.activities_code_snippet_parentheses), "(", ")"),
        )

@Composable
private fun PatternTesterActivity(props: ActivityProps) {
    val fields = (props.content as PatternTesterContent).value.fields
    val regex = (fields as? RegexFieldsValue)?.value
    val formula = (fields as? FormulaFieldsValue)?.value
    val onAnswerChange by rememberUpdatedState(props.onAnswerChange)
    val focus = remember { FocusRequester() }
    val value =
        rememberTextFieldState(if (props.isExploring) regex?.solution ?: formula?.solution.orEmpty() else props.answer.pattern.orEmpty())
    LaunchedEffect(value) {
        snapshotFlow { value.text.toString() }.drop(1).collect { text ->
            onAnswerChange(text.takeIf { it.jsTrim().isNotEmpty() }?.let(::patternAnswer))
        }
    }

    ActivityCanvas(gap = 16.dp) {
        if (!props.isExploring) {
            RichText(
                regex?.task ?: formula?.task.orEmpty(),
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                literalNumbers = regex != null,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PatternField(value, isRegex = regex != null, props.isLocked || props.isChecked, focus)
            // Main keeps a checked answer's keys, disabled, so nothing under them moves.
            SnippetBar(
                snippets = if (formula != null) formulaSnippets(formula) else regexSnippets(),
                label = stringResource(R.string.activities_code_symbols),
                enabled = !props.isLocked && !props.isChecked,
                onInsert = { snippet ->
                    value.insertSnippet(snippet)
                    focus.requestFocus()
                },
            )
        }
        if (regex != null) RegexExamples(regex, value.text.toString())
        if (formula != null) FormulaExamples(formula, value.text.toString())
        if (!props.isExploring) {
            PatternHints(
                regex?.hints ?: formula?.hints.orEmpty(),
                props.isChecked,
                props.isLocked,
                props.isCorrect,
                literalNumbers =
                    regex != null,
            )
        }
        if (props.isChecked && props.isCorrect != true) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                ActivityCanvasLabel(
                    stringResource(
                        if (regex != null) R.string.activities_code_pattern_that_works else R.string.activities_code_formula_that_works,
                    ),
                )
                val colors = MaterialTheme.colorScheme
                val shape = RoundedCornerShape(ZoonkRadius.xl)
                Text(
                    if (regex != null) "/${regex.solution}/" else "=${formula?.solution.orEmpty()}",
                    Modifier
                        .clip(shape)
                        .background(colors.surface)
                        .border(1.dp, colors.outlineVariant, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    style = MaterialTheme.zoonkType.codeField,
                )
            }
        }
    }
}

@Composable
private fun PatternField(
    value: TextFieldState,
    isRegex: Boolean,
    readOnly: Boolean,
    focus: FocusRequester,
) {
    val colors = MaterialTheme.colorScheme
    val style = MaterialTheme.zoonkType.codeField.copy(color = colors.onSurface)
    var focused by remember { mutableStateOf(false) }
    val label = stringResource(if (isRegex) R.string.activities_code_your_pattern else R.string.activities_code_your_formula)
    val delimiter = @Composable { Text("/", Modifier.clearAndSetSemantics {}, color = colors.onSurfaceVariant, style = style) }

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .codeField(colors, focused)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (isRegex) delimiter()
        BasicTextField(
            state = value,
            modifier =
                Modifier
                    .weight(1f)
                    .focusRequester(focus)
                    .onFocusChanged { focused = it.isFocused }
                    .semantics { contentDescription = label },
            readOnly = readOnly,
            textStyle = style,
            keyboardOptions = codeKeyboard,
            lineLimits = TextFieldLineLimits.SingleLine,
            cursorBrush = SolidColor(colors.primary),
            decorator = { field ->
                Box {
                    if (!isRegex && value.text.isEmpty()) {
                        Text(stringResource(R.string.activities_code_formula_placeholder), color = colors.onSurfaceVariant, style = style)
                    }
                    field()
                }
            },
        )
        if (isRegex) delimiter()
    }
}

/** Main's `PatternExamples` for a regex: each sample tested with JavaScript's engine as core grades it. */
@Composable
private fun RegexExamples(
    fields: RegexFields,
    pattern: String,
) {
    val sandbox = LocalCodeSandbox.current
    rememberSandboxRuntime(sandbox, CodeLanguage.JavaScript)
    var results by remember { mutableStateOf<RegexTest?>(null) }
    LaunchedEffect(sandbox, pattern) { results = sandbox.testRegex(pattern, fields.shouldMatch, fields.shouldNotMatch) }
    val tested = results as? RegexTest.Tested
    val summary =
        tested?.let {
            val all = it.shouldMatch + it.shouldNotMatch
            val passing = all.count(SampleResult::passes)
            pluralStringResource(R.plurals.activities_code_examples_pass, passing, passing, all.size)
        }

    Column(
        Modifier.semantics {
            summary?.let {
                liveRegion = LiveRegionMode.Polite
                stateDescription = it
            }
        },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (results == RegexTest.Invalid) {
            Text(
                stringResource(R.string.activities_code_pattern_cant_run),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        SampleList(stringResource(R.string.activities_code_should_match), fields.shouldMatch, tested?.shouldMatch, shouldMatch = true)
        SampleList(
            stringResource(R.string.activities_code_should_not_match),
            fields.shouldNotMatch,
            tested?.shouldNotMatch,
            shouldMatch = false,
        )
    }
}

/** Main's `RegexSampleList`. */
@Composable
private fun SampleList(
    label: String,
    samples: List<String>,
    results: List<SampleResult>?,
    shouldMatch: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(label, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            results?.let { tested ->
                val passing = tested.count(SampleResult::passes)
                val all = passing == samples.size
                Text(
                    pluralStringResource(R.plurals.activities_code_pass_count, passing, passing, samples.size),
                    color = if (all) colors.onSurfaceVariant else colors.error,
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = if (all) FontWeight.Normal else FontWeight.Medium),
                )
            }
        }
        samples.forEachIndexed { index, sample -> SampleRow(sample, results?.getOrNull(index), shouldMatch) }
    }
}

@Composable
private fun SampleRow(
    sample: String,
    result: SampleResult?,
    shouldMatch: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(ZoonkRadius.option)
    val failing = result?.passes == false
    val words = if (shouldMatch) colors.onTertiaryContainer else colors.error
    val tint = if (shouldMatch) colors.tertiary else MaterialTheme.zoonk.destructive
    // Main's tested row: the right answer's line and tint when it passes, the wrong one's when it fails.
    val tone = answerTone(picked = false, result = result?.let { if (it.passes) AnswerResult.Right else AnswerResult.Wrong })
    val status =
        result?.let {
            stringResource(
                when {
                    it.passes && shouldMatch -> R.string.activities_code_sample_matches
                    it.passes -> R.string.activities_code_sample_doesnt_match
                    shouldMatch -> R.string.activities_code_sample_no_match
                    else -> R.string.activities_code_sample_matched
                },
            )
        }
    val match = result?.match?.takeIf { it.end > it.start }
    val marked =
        buildAnnotatedString {
            if (match == null) {
                append(sample)
            } else {
                append(sample.substring(0, match.start))
                withStyle(SpanStyle(color = words, background = tint.copy(alpha = SOFT_ALPHA))) {
                    append(sample.substring(match.start, match.end))
                }
                append(sample.substring(match.end))
            }
        }

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(colors.surface)
            .then(
                if (result == null) {
                    Modifier.border(1.dp, colors.outlineVariant, shape)
                } else {
                    Modifier.background(tone.container).border(tone.border, shape)
                },
            ).semantics(mergeDescendants = true) { status?.let { stateDescription = it } }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            marked,
            Modifier.weight(1f).fadingHorizontalScroll(rememberScrollState()),
            softWrap = false,
            style = MaterialTheme.zoonkType.codeField,
        )
        if (failing && status != null) {
            Text(
                status,
                Modifier.clearAndSetSemantics {},
                color = colors.error,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
            )
        }
        if (result != null) {
            Icon(
                painterResource(if (result.passes) R.drawable.ic_check else R.drawable.ic_close),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = if (result.passes) colors.tertiary else colors.error,
            )
        }
    }
}

/** Main's `FormulaExamples`: each example's cells, what it should give and what the formula gives. */
@Composable
private fun FormulaExamples(
    fields: FormulaFields,
    formula: String,
) {
    val colors = MaterialTheme.colorScheme
    val locale = currentLocale()
    val shape = RoundedCornerShape(ZoonkRadius.option)
    val names =
        fields.examples
            .firstOrNull()
            ?.inputs
            ?.map { it.name }
            .orEmpty()
    val results = if (formula.jsTrim().isEmpty()) null else testFormula(formula, fields.examples, fields.tolerance)
    val passing = results?.count(FormulaResult::passes)
    val summary = passing?.let { pluralStringResource(R.plurals.activities_code_examples_pass, it, it, fields.examples.size) }
    val cell = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
    val number = MaterialTheme.typography.bodyMedium

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outlineVariant, shape)
            .semantics {
                summary?.let {
                    liveRegion = LiveRegionMode.Polite
                    stateDescription = it
                }
            },
    ) {
        Row(Modifier.background(tableHeaderColor())) {
            val header = MaterialTheme.typography.labelMedium
            val muted = colors.onSurfaceVariant
            names.forEach { Text(it, cell.weight(1f), color = muted, style = header.copy(fontFamily = GeistMono)) }
            listOf(R.string.activities_code_should_give, R.string.activities_code_your_result).forEach {
                Text(stringResource(it), cell.weight(1f), color = muted, textAlign = TextAlign.End, style = header)
            }
        }
        fields.examples.forEachIndexed { index, example ->
            val result = results?.getOrNull(index)
            HorizontalDivider(color = colors.outlineVariant)
            Row(
                Modifier
                    .background(if (result?.passes == false) MaterialTheme.zoonk.destructive.copy(alpha = SOFT_ALPHA) else colors.surface)
                    .semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.CenterVertically,
            ) {
                example.inputs.forEach { Text(formatAmount(it.`value`, locale), cell.weight(1f), style = number) }
                Text(
                    formatAmount(example.output, locale),
                    cell.weight(1f),
                    textAlign = TextAlign.End,
                    style = number.copy(fontWeight = FontWeight.Medium),
                )
                Row(
                    cell.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    result?.value?.let { Text(formatAmount(it, locale), style = number) }
                    if (result?.value != null) {
                        val verdict =
                            if (result.passes) R.string.activities_code_sample_matches else R.string.activities_code_sample_doesnt_match
                        Icon(
                            painterResource(if (result.passes) R.drawable.ic_check else R.drawable.ic_close),
                            contentDescription = stringResource(verdict),
                            modifier = Modifier.size(16.dp),
                            tint = if (result.passes) colors.tertiary else colors.error,
                        )
                    }
                }
            }
        }
    }
}

/** Main's `PatternHints`: one more at each tap, and every hint once checked. */
@Composable
private fun PatternHints(
    hints: List<PatternHint>,
    isChecked: Boolean,
    isLocked: Boolean,
    correct: Boolean?,
    literalNumbers: Boolean,
) {
    var shown by rememberSaveable { mutableIntStateOf(0) }
    if (hints.isEmpty()) return
    val visible = hints.take(patternHintCount(hints.size, shown, isChecked, correct))
    val style = MaterialTheme.typography.bodyMedium

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (visible.isNotEmpty()) {
            Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                visible.forEach { hint ->
                    Row(Modifier.semantics(mergeDescendants = true) {}, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LineMarker(style) {
                            Icon(
                                painterResource(R.drawable.ic_lightbulb),
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.zoonk.vizHighlight,
                            )
                        }
                        // Main's one line: the mistake in bold, then what to try.
                        RichText(
                            "**${stringResource(R.string.activities_code_hint_mistake, hint.mistake)}** ${hint.hint}",
                            style = style,
                            literalNumbers = literalNumbers,
                        )
                    }
                }
            }
        }
        // Main keeps the button, disabled, once a passing answer is checked.
        if (visible.size < hints.size) {
            OutlinedButton(onClick = { shown += 1 }, enabled = !isLocked && !isChecked) {
                Icon(painterResource(R.drawable.ic_lightbulb), null, Modifier.size(18.dp))
                Text(
                    stringResource(if (shown == 0) R.string.activities_code_show_hint else R.string.activities_code_show_another_hint),
                    Modifier.padding(start = 8.dp),
                )
            }
        }
    }
}

internal fun patternHintCount(
    total: Int,
    shown: Int,
    checked: Boolean,
    correct: Boolean?,
): Int = if (checked && correct != true) total else shown.coerceIn(0, total)
