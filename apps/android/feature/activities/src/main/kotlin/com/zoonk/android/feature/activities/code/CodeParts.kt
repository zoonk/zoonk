package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.OutputTransformation
import androidx.compose.foundation.text.input.TextFieldBuffer
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.insert
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.code.CodeColors
import com.zoonk.android.ui.code.codeColors
import com.zoonk.android.ui.code.highlightCode
import com.zoonk.android.ui.code.styledCodeLine
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

/** The app's one sandbox; the lesson screen provides it. */
val LocalCodeSandbox = staticCompositionLocalOf<CodeSandbox> { error("The lesson screen provides the code sandbox") }

internal val CodeLanguage.fenceName: String
    get() =
        when (this) {
            CodeLanguage.JavaScript -> "javascript"
            CodeLanguage.Python -> "python"
            CodeLanguage.Sql -> "sql"
        }

private data class Highlighting(
    private val language: CodeLanguage,
    private val colors: CodeColors,
) : OutputTransformation {
    override fun TextFieldBuffer.transformOutput() {
        var offset = 0
        highlightCode(asCharSequence().toString(), language.fenceName).forEach { tokens ->
            val line = styledCodeLine(tokens, colors, field = true)
            line.spanStyles.forEach { span -> addStyle(span.item, offset + span.start, offset + span.end) }
            offset += line.length + 1
        }
    }
}

internal val codeKeyboard =
    KeyboardOptions(capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, keyboardType = KeyboardType.Ascii)

private fun KeyEvent.isEnter() = key == Key.Enter || key == Key.NumPadEnter

/**
 * Measures a field at a 48 dp touch height but takes only one code [line]'s room, reaching into the lines around it,
 * so an editable line keeps the listing's rhythm.
 */
private fun Modifier.reachingNeighbors(line: Dp): Modifier =
    layout { measurable, constraints ->
        val touch = maxOf(constraints.minHeight, TOUCH_HEIGHT.roundToPx())
        val placeable = measurable.measure(constraints.copy(minHeight = touch, maxHeight = maxOf(constraints.maxHeight, touch)))
        val height = line.roundToPx()
        layout(placeable.width, height) { placeable.placeRelative(0, (height - placeable.height) / 2) }
    }

private val TOUCH_HEIGHT = 48.dp

/** Main's `ActivityCodeLineInput`: one line of code to edit in place; Enter runs the program. */
@Composable
internal fun CodeLineField(
    state: TextFieldState,
    language: CodeLanguage,
    label: String,
    readOnly: Boolean,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BasicTextField(
        state = state,
        modifier =
            modifier
                .reachingNeighbors(
                    with(LocalDensity.current) {
                        MaterialTheme.zoonkType.codeField.lineHeight
                            .toDp()
                    },
                ).semantics { contentDescription = label }
                .onPreviewKeyEvent { event ->
                    if (event.isEnter() && event.type == KeyEventType.KeyDown) onSubmit()
                    event.isEnter()
                },
        readOnly = readOnly,
        textStyle = MaterialTheme.zoonkType.codeField.copy(color = MaterialTheme.colorScheme.onSurface),
        keyboardOptions = codeKeyboard,
        lineLimits = TextFieldLineLimits.SingleLine,
        onKeyboardAction = { onSubmit() },
        outputTransformation = Highlighting(language, codeColors()),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        decorator = { field -> Box(contentAlignment = Alignment.CenterStart) { field() } },
    )
}

/**
 * Main's `ActivityCodeEditor`: highlighted code that wraps at the editor's edge. Enter starts a new
 * line and Ctrl or Cmd with Enter runs it.
 */
@Composable
internal fun CodeEditor(
    state: TextFieldState,
    language: CodeLanguage,
    label: String,
    placeholder: String,
    focusRequester: FocusRequester,
    onSubmit: () -> Unit,
    readOnly: Boolean,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(ZoonkRadius.xl)
    val style = MaterialTheme.zoonkType.codeField.copy(color = colors.onSurface)
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outlineVariant, shape),
    ) {
        BasicTextField(
            state = state,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = EDITOR_PADDING, vertical = 12.dp)
                    .heightIn(min = 48.dp)
                    .focusRequester(focusRequester)
                    .semantics { contentDescription = label }
                    .onPreviewKeyEvent { event ->
                        val submit = event.isEnter() && (event.isCtrlPressed || event.isMetaPressed)
                        if (submit && event.type == KeyEventType.KeyDown) onSubmit()
                        submit
                    },
            readOnly = readOnly,
            textStyle = style,
            keyboardOptions = codeKeyboard,
            outputTransformation = Highlighting(language, codeColors()),
            cursorBrush = SolidColor(colors.primary),
            decorator = { field ->
                Box {
                    if (state.text.isEmpty()) Text(placeholder, color = colors.onSurfaceVariant, style = style)
                    field()
                }
            },
        )
    }
}

/** Saves drafts keyed by [key]'s text, like edited lines by number, for `rememberSaveable`. */
internal fun <K> draftsSaver(key: (String) -> K) =
    Saver<Map<K, String>, ArrayList<String>>(
        save = { drafts -> drafts.flatMapTo(ArrayList()) { (k, text) -> listOf(k.toString(), text) } },
        restore = { saved -> saved.chunked(2).associate { (k, text) -> key(k) to text } },
    )

/** Main's `CodeSnippet`: [before] goes in front of the selection and [after] behind it. */
data class CodeSnippet(
    val label: String,
    val name: String,
    val before: String,
    val after: String = "",
)

/** Main's `insertAtCursor`: wraps the selection in the snippet and puts the cursor after what it wrapped. */
fun TextFieldState.insertSnippet(snippet: CodeSnippet) {
    edit {
        val start = selection.min
        val end = selection.max
        insert(end, snippet.after)
        insert(start, snippet.before)
        selection = TextRange(end + snippet.before.length)
    }
}

/** Main's `ActivitySnippetBar`: buttons that type a symbol or name, each named for TalkBack when its label is a symbol. */
@Composable
internal fun SnippetBar(
    snippets: List<CodeSnippet>,
    label: String,
    enabled: Boolean,
    onInsert: (CodeSnippet) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .semantics { contentDescription = label }
            .fadingHorizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        snippets.forEach { snippet ->
            OutlinedButton(
                onClick = { onInsert(snippet) },
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .widthIn(min = 48.dp)
                        .then(
                            if (snippet.name == snippet.label) {
                                Modifier
                            } else {
                                Modifier.semantics { contentDescription = "${snippet.label}, ${snippet.name}" }
                            },
                        ),
                enabled = enabled,
                shape = RoundedCornerShape(ZoonkRadius.option),
                contentPadding = PaddingValues(horizontal = 12.dp),
            ) {
                Text(snippet.label, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = GeistMono))
            }
        }
    }
}

/**
 * Main's `SandboxRunBar`: Run stays secondary, so the screen's Check or Continue stands out. Runs wait for the
 * runtime, so Run works while it loads.
 */
@Composable
internal fun SandboxRunBar(
    runtimeName: String,
    runtime: SandboxRuntime,
    hasRun: Boolean,
    isExploring: Boolean,
    isRunning: Boolean,
    onRun: () -> Unit,
    onReset: (() -> Unit)? = null,
    canRun: Boolean = true,
) {
    if (runtime.status == SandboxRuntimeStatus.Failed) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(R.string.activities_code_runtime_failed, runtimeName),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedButton(onClick = runtime::retry) {
                Icon(painterResource(R.drawable.ic_refresh), contentDescription = null, Modifier.size(18.dp))
                Text(stringResource(R.string.load_failed_try_again), Modifier.padding(start = 8.dp))
            }
        }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (onReset != null) {
                OutlinedButton(
                    onClick = onReset,
                    enabled = !isRunning,
                    leadingIcon = { ButtonIcon(R.drawable.ic_replay) },
                    size = ButtonSize.Large,
                ) {
                    Text(stringResource(R.string.activities_code_start_over))
                }
            }
            OutlinedButton(
                onClick = onRun,
                enabled = canRun,
                busy = isRunning,
                leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
                size = ButtonSize.Large,
            ) {
                Text(stringResource(if (isExploring && hasRun) R.string.activities_code_run_again else R.string.activities_code_run))
            }
        }
        if (runtime.status == SandboxRuntimeStatus.Loading) {
            Text(
                stringResource(R.string.activities_code_runtime_loading, runtimeName),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

internal const val SOFT_ALPHA = 0.12f
internal const val STALE_ALPHA = 0.6f
private val EDITOR_PADDING = 16.dp
