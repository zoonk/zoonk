package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.jsonSaver
import com.zoonk.android.ui.code.CodeFrame
import com.zoonk.android.ui.code.CodeLine
import com.zoonk.android.ui.code.CodeLineText
import com.zoonk.android.ui.code.CodeLineTone
import com.zoonk.android.ui.code.highlightCode
import com.zoonk.android.ui.code.rememberSpokenCode
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf16Fields
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf16Value as CodeRunnerContent

val codeRunnerRenderer =
    ActivityRenderer(
        badge = { null },
        canvas = { CodeRunnerActivity(it) },
    )

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

private val RunSaver = jsonSaver(sandboxJson, ProgramRun.serializer())

@Composable
private fun CodeRunnerActivity(props: ActivityProps) {
    val fields = (props.content as CodeRunnerContent).value.fields
    val language = fields.codeLanguage ?: return
    val sandbox = LocalCodeSandbox.current
    val runtime = rememberSandboxRuntime(sandbox, language)
    val editorRun = rememberEditorRun()
    val scope = rememberCoroutineScope()
    val onAnswerChange by rememberUpdatedState(props.onAnswerChange)
    val isLocked by rememberUpdatedState(props.isLocked)
    val original = if (props.isExploring) fields.solution else fields.starterCode
    val lines = original.lines()
    val editors =
        fields.editableLines.map(Long::toInt).filter { it in 1..lines.size }.associateWith { number ->
            rememberTextFieldState(lines[number - 1])
        }
    var run by rememberSaveable(stateSaver = RunSaver) { mutableStateOf(props.answer.output?.let(ProgramRun::printed)) }
    val program = programWithEdits(original, editors.mapValues { it.value.text.toString() })
    // References to runProgram compare equal whatever they capture, so Run and Enter can keep an older one: it reads this instead.
    val currentProgram by rememberUpdatedState(program)
    val matches = run?.let { sameOutput(it.output, fields.expectedOutput) } == true
    val mistake = run?.takeUnless { matches || props.isExploring }?.let { mistakeFor(it.output, fields.mistakes)?.feedback }

    fun runProgram() {
        if (isLocked) return
        val revision = editorRun.start() ?: return
        val code = currentProgram
        scope.launch {
            val result = sandbox.runProgram(code, language)
            val current = editorRun.finish(revision)
            if (isLocked) return@launch
            run = result
            onAnswerChange(if (!current || result.stop == ProgramStop.Unavailable) null else outputAnswer(result.output))
        }
    }

    LaunchedEffect(original, editors) {
        snapshotFlow { editors.values.map { it.text.toString() } }.drop(1).collect {
            editorRun.edit()
            onAnswerChange(null)
        }
    }

    ActivityCanvas {
        CodePanel(
            fields,
            language,
            program,
            run,
            editorRun.isStale,
            props.isLocked,
            marksYourLines = !props.isExploring,
            editors = editors,
            onRun = ::runProgram,
        )
        CodeRunnerOutput(fields.expectedOutput.takeUnless { props.isExploring }, language, run, matches, mistake, editorRun.isStale)
        if (!props.isChecked) {
            SandboxRunBar(
                runtimeName = language.runtimeName,
                runtime = runtime,
                hasRun = run != null,
                isExploring = props.isExploring,
                isRunning = editorRun.isRunning,
                onRun = ::runProgram,
                onReset =
                    if (program == original ||
                        props.isLocked
                    ) {
                        null
                    } else {
                        ({ editors.forEach { (number, state) -> state.setTextAndPlaceCursorAtEnd(lines[number - 1]) } })
                    },
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
    marksYourLines: Boolean,
    editors: Map<Int, TextFieldState>,
    onRun: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(ZoonkRadius.xl)
    val editable = fields.editableLines.map(Long::toInt).toSet()
    val lines = program.split("\n")
    val highlightedLines = highlightCode(program, language.fenceName)
    val style = MaterialTheme.zoonkType.codeField
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
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                fields.fileName ?: language.defaultFileName,
                Modifier.weight(1f),
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.copy(fontFamily = GeistMono),
            )
            if (marksYourLines) {
                // Main's "Edit line 2" goes once checked, keeping its room so the header doesn't move.
                Text(
                    pluralStringResource(
                        R.plurals.activities_code_edit_lines,
                        fields.editableLines.size,
                        formatList(fields.editableLines.map(Long::toString), currentLocale()),
                    ),
                    Modifier
                        .alpha(if (isLocked) 0f else 1f)
                        .then(if (isLocked) Modifier.clearAndSetSemantics {} else Modifier),
                    color = colors.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
        val spoken = rememberSpokenCode()
        // Editable lines are one-line fields, so the program keeps its lines' shape and scrolls.
        CodeFrame(stringResource(R.string.activities_code_code), wraps = false, stopPerLine = true, holdsFields = true) {
            lines.forEachIndexed { index, line ->
                val number = index + 1
                val isError = errorLine == number
                if (number in editable) {
                    // A checked line is plain code again, so its edit outline goes with the field.
                    val tone =
                        when {
                            isError -> CodeLineTone.Error
                            isLocked -> CodeLineTone.Plain
                            else -> CodeLineTone.Editable
                        }
                    CodeLine(number, digits, tone = tone, style = style) {
                        CodeLineField(
                            state = editors.getValue(number),
                            language = language,
                            label = stringResource(R.string.activities_code_line_yours, number),
                            readOnly = isLocked,
                            onSubmit = onRun,
                            modifier = Modifier.weight(1f),
                        )
                    }
                } else {
                    CodeLine(
                        number,
                        digits,
                        tone = if (isError) CodeLineTone.Error else CodeLineTone.Plain,
                        spoken = spoken.line(line, number),
                        style = style,
                    ) {
                        CodeLineText(highlightedLines.getOrElse(index) { emptyList() }, wraps = false, style = style)
                    }
                }
            }
        }
    }
}

/** Main's `CodeRunnerOutput`: what the program printed, beside what it should print when it has a target, then why it stopped. */
@Composable
private fun CodeRunnerOutput(
    expectedOutput: String?,
    language: CodeLanguage,
    run: ProgramRun?,
    matches: Boolean,
    mistake: String?,
    isStale: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(ZoonkRadius.xl)
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
                stringResource(R.string.activities_code_output),
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
                PrintedOutput(run, matches, hasTarget = expectedOutput != null && !isStale)
            }
            if (expectedOutput != null) {
                VerticalDivider(Modifier.fillMaxHeight(), color = colors.outlineVariant)
                OutputCell(stringResource(R.string.activities_code_expected), Modifier.weight(1f)) {
                    OutputText(expectedOutput.trimEnd())
                }
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
                    .fadingHorizontalScroll(rememberScrollState())
                    .semantics { liveRegion = LiveRegionMode.Polite },
                color = colors.onSurfaceVariant,
                softWrap = false,
                style = MaterialTheme.typography.bodySmall.copy(fontFamily = GeistMono),
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
        content()
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
        modifier.fadingHorizontalScroll(rememberScrollState()),
        color = color,
        softWrap = false,
        style = MaterialTheme.typography.titleMedium.copy(fontFamily = GeistMono, fontWeight = FontWeight.SemiBold),
    )
}

@Composable
private fun PrintedOutput(
    run: ProgramRun?,
    matches: Boolean,
    hasTarget: Boolean,
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
                    !hasTarget -> colors.onSurface
                    matches -> colors.onTertiaryContainer
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
    val style = MaterialTheme.typography.bodyMedium.copy(fontFamily = GeistMono)
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
