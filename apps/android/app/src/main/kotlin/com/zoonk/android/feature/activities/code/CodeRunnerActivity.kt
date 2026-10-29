package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf16Fields
import kotlinx.coroutines.launch
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf16Value as CodeRunnerContent

val codeRunnerRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_code_badge_run, R.drawable.ic_terminal) },
        canvas = { CodeRunnerActivity(it) },
    )

private val PlayableLibraryStepAnyOfContentOneOf16Fields.codeLanguage
    get() =
        when (language) {
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.JAVASCRIPT -> CodeLanguage.JavaScript
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.PYTHON -> CodeLanguage.Python
        }

private val CodeLanguage.runtimeName
    get() =
        when (this) {
            CodeLanguage.JavaScript -> "JavaScript"
            CodeLanguage.Python -> "Python"
            CodeLanguage.Sql -> "SQLite"
        }

private val CodeLanguage.defaultFileName
    get() =
        when (this) {
            CodeLanguage.JavaScript -> "main.js"
            CodeLanguage.Python -> "main.py"
            CodeLanguage.Sql -> "query.sql"
        }

@Composable
private fun CodeRunnerActivity(props: ActivityProps) {
    val fields = (props.content as CodeRunnerContent).value.fields
    val language = fields.codeLanguage
    val sandbox = LocalCodeSandbox.current
    val runtime = rememberSandboxRuntime(sandbox, language)
    val editorRun = rememberEditorRun()
    val scope = rememberCoroutineScope()
    val onAnswerChange by rememberUpdatedState(props.onAnswerChange)
    var edits by rememberSaveable(stateSaver = LineEditsSaver) { mutableStateOf(emptyMap<Int, String>()) }
    var run by remember { mutableStateOf(props.answer.output?.let(ProgramRun::printed)) }
    val program = programWithEdits(fields.starterCode, edits)
    val matches = run?.let { sameOutput(it.output, fields.expectedOutput) } == true
    val mistake = run?.takeUnless { matches }?.let { mistakeFor(it.output, fields.mistakes)?.feedback }

    fun runProgram() {
        if (props.isLocked) return
        val revision = editorRun.start() ?: return
        scope.launch {
            val result = sandbox.runProgram(program, language)
            val current = editorRun.finish(revision)
            run = result
            onAnswerChange(if (!current || result.stop == ProgramStop.Unavailable) null else outputAnswer(result.output))
        }
    }

    fun change(next: Map<Int, String>) {
        edits = next
        editorRun.edit()
        onAnswerChange(null)
    }

    ActivityCanvas {
        CodePanel(fields, language, program, run, editorRun.isStale, props.isLocked, onEdit = {
            line,
            text,
            ->
            change(edits + (line to text))
        }, onRun = ::runProgram)
        CodeRunnerOutput(fields.expectedOutput, language, run, matches, mistake, editorRun.isStale)
        if (!props.isChecked) {
            SandboxRunBar(
                runtimeName = language.runtimeName,
                runtime = runtime,
                hasRun = run != null,
                isRunning = editorRun.isRunning,
                onRun = ::runProgram,
                onReset = if (edits.isEmpty() || props.isLocked) null else ({ change(emptyMap()) }),
            )
        }
    }
}

@Composable
private fun CodePanel(
    fields: PlayableLibraryStepAnyOfContentOneOf16Fields,
    language: CodeLanguage,
    program: String,
    run: ProgramRun?,
    isStale: Boolean,
    isLocked: Boolean,
    onEdit: (Int, String) -> Unit,
    onRun: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(16.dp)
    val editable = fields.editableLines.map(Long::toInt).toSet()
    val lines = program.split("\n")
    val highlightedLines = highlightCode(program, language)
    val digits = lines.size.toString().length
    val errorLine = run?.error?.line?.takeUnless { isStale }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outlineVariant, shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                fields.fileName ?: language.defaultFileName,
                Modifier.weight(1f),
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.copy(fontFamily = FontFamily.Monospace),
            )
            val style = MaterialTheme.typography.labelMedium
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                LineMarker(style) { Icon(painterResource(R.drawable.ic_edit), null, Modifier.size(12.dp), tint = colors.onSurfaceVariant) }
                Text(
                    pluralStringResource(
                        R.plurals.activities_code_lines_yours,
                        fields.editableLines.size,
                        formatList(fields.editableLines.map(Long::toString), currentLocale()),
                    ),
                    color = colors.onSurfaceVariant,
                    style = style,
                )
            }
        }
        CodeBlock(stringResource(R.string.activities_code_code)) {
            lines.forEachIndexed { index, line ->
                val number = index + 1
                val isError = errorLine == number
                if (number in editable) {
                    CodeLine(number, digits, if (isError) CodeLineTone.Error else CodeLineTone.Editable) {
                        CodeLineField(
                            value = line,
                            onValueChange = { onEdit(number, it) },
                            language = language,
                            label = stringResource(R.string.activities_code_line_yours, number),
                            readOnly = isLocked,
                            onSubmit = onRun,
                            modifier = Modifier.weight(1f),
                        )
                    }
                } else {
                    CodeLine(number, digits, if (isError) CodeLineTone.Error else CodeLineTone.Plain) {
                        Text(highlighted(highlightedLines.getOrElse(index) { emptyList() }), softWrap = false, style = codeTextStyle())
                    }
                }
            }
        }
    }
}

/** Main's `CodeRunnerOutput`: what the program printed beside what it should print, then why it stopped. */
@Composable
private fun CodeRunnerOutput(
    expectedOutput: String,
    language: CodeLanguage,
    run: ProgramRun?,
    matches: Boolean,
    mistake: String?,
    isStale: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .clip(shape)
                .background(colors.surface)
                .border(1.dp, colors.outlineVariant, shape),
        ) {
            OutputCell(
                stringResource(R.string.activities_code_your_output),
                Modifier.weight(1f).alpha(
                    if (isStale &&
                        run != null
                    ) {
                        STALE_ALPHA
                    } else {
                        1f
                    },
                ),
            ) {
                PrintedOutput(run, matches, isStale)
            }
            VerticalDivider(Modifier.fillMaxHeight(), color = colors.outlineVariant)
            OutputCell(stringResource(R.string.activities_code_expected), Modifier.weight(1f)) {
                OutputText(expectedOutput.trimEnd())
            }
        }

        if (isStale && run != null) {
            Text(
                stringResource(R.string.activities_code_changed_code),
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (run != null && !isStale) StopNotice(language, run)
        if (run != null && run.errorOutput.isNotEmpty() && !isStale) {
            Text(
                run.errorOutput,
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .semantics { liveRegion = LiveRegionMode.Polite },
                color = colors.onSurfaceVariant,
                softWrap = false,
                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
            )
        }
        if (mistake != null && !isStale) NotQuite(mistake)
    }
}

@Composable
private fun OutputCell(
    label: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        Column(Modifier.horizontalScroll(rememberScrollState()), content = content)
    }
}

@Composable
private fun OutputText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
) {
    Text(
        text,
        modifier,
        color = color,
        softWrap = false,
        style = MaterialTheme.typography.titleMedium.copy(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold),
    )
}

@Composable
private fun PrintedOutput(
    run: ProgramRun?,
    matches: Boolean,
    isStale: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val live = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    when {
        run == null -> {
            Text(
                stringResource(R.string.activities_code_run_to_see),
                live,
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        run.output.isEmpty() -> {
            Text(
                stringResource(R.string.activities_code_nothing_printed),
                live,
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        else -> {
            val tone =
                when {
                    isStale -> colors.onSurface
                    matches -> colors.tertiary
                    else -> colors.error
                }
            OutputText(run.output.trimEnd(), live, tone)
        }
    }
}

/** Main's `StopNotice`: the error and its line, or why the run was stopped. */
@Composable
private fun StopNotice(
    language: CodeLanguage,
    run: ProgramRun,
) {
    val error = run.error
    val message =
        when {
            run.stop == ProgramStop.Error && error != null -> {
                error.line?.let { stringResource(R.string.activities_code_error_line, it, error.message) } ?: error.message
            }

            run.stop == ProgramStop.Timeout -> {
                pluralStringResource(R.plurals.activities_code_stopped_after, language.timeLimitSeconds, language.timeLimitSeconds)
            }

            run.stop == ProgramStop.TooMuchOutput -> {
                stringResource(R.string.activities_code_too_much_output)
            }

            else -> {
                return
            }
        }
    val style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace)
    Row(
        Modifier.semantics(mergeDescendants = true) {
            liveRegion = LiveRegionMode.Polite
        },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LineMarker(
            style,
        ) { Icon(painterResource(R.drawable.ic_cancel), null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error) }
        Text(message, color = MaterialTheme.colorScheme.error, style = style)
    }
}

@Composable
private fun NotQuite(mistake: String) {
    val style = MaterialTheme.typography.bodyMedium
    Row(Modifier.semantics(mergeDescendants = true) {}, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        LineMarker(
            style,
        ) { Icon(painterResource(R.drawable.ic_cancel), null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error) }
        Column {
            Text(
                stringResource(R.string.activities_code_not_quite),
                color = MaterialTheme.colorScheme.error,
                style = style.copy(fontWeight = FontWeight.SemiBold),
            )
            RichText(mistake, style = style)
        }
    }
}

private val LineEditsSaver =
    Saver<Map<Int, String>, ArrayList<String>>(
        save = { edits -> edits.flatMapTo(ArrayList()) { (line, text) -> listOf(line.toString(), text) } },
        restore = { saved -> saved.chunked(2).associate { (line, text) -> line.toInt() to text } },
    )
