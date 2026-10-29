package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.theme.zoonk

/** The app's one sandbox; the lesson screen provides it. */
val LocalCodeSandbox = staticCompositionLocalOf<CodeSandbox> { error("The lesson screen provides the code sandbox") }

enum class CodeLineTone { Plain, Current, Editable, Error }

@Composable
internal fun codeTextStyle(): TextStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = FontFamily.Monospace)

private data class CodePalette(
    val builtin: Color,
    val comment: Color,
    val keyword: Color,
    val literal: Color,
) {
    fun styled(tokens: List<CodeToken>) =
        buildAnnotatedString {
            tokens.forEach { token ->
                val style =
                    when (token.kind) {
                        CodeTokenKind.Builtin -> SpanStyle(color = builtin)
                        CodeTokenKind.Comment -> SpanStyle(color = comment, fontStyle = FontStyle.Italic)
                        CodeTokenKind.Keyword -> SpanStyle(color = keyword)
                        CodeTokenKind.Number, CodeTokenKind.String -> SpanStyle(color = literal)
                        CodeTokenKind.Plain -> SpanStyle()
                    }
                withStyle(style) { append(token.text) }
            }
        }
}

@Composable
private fun codePalette() =
    CodePalette(
        builtin = MaterialTheme.zoonk.vizSecondary,
        comment = MaterialTheme.colorScheme.onSurfaceVariant,
        keyword = MaterialTheme.zoonk.vizAccent,
        literal = MaterialTheme.zoonk.vizHighlight,
    )

@Composable
internal fun highlighted(tokens: List<CodeToken>): AnnotatedString = codePalette().styled(tokens)

/** Main's `ActivityCodeBlock`: code scrolls sideways instead of wrapping, each line as wide as the longest. */
@Composable
internal fun CodeBlock(
    label: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    BoxWithConstraints(modifier.fillMaxWidth().semantics { contentDescription = label }) {
        Column(
            Modifier
                .horizontalScroll(rememberScrollState())
                .widthIn(min = maxWidth)
                .width(IntrinsicSize.Max),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            content()
        }
    }
}

/** A line of code after its number, which TalkBack skips; the number keeps its width across a listing. */
@Composable
internal fun CodeLine(
    number: Int,
    digits: Int,
    tone: CodeLineTone,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val highlight = MaterialTheme.zoonk.vizHighlight
    val shape = RoundedCornerShape(8.dp)
    val toned =
        when (tone) {
            CodeLineTone.Plain -> {
                Modifier
            }

            CodeLineTone.Current -> {
                Modifier.background(highlight.copy(alpha = SOFT_ALPHA), shape).drawBehind {
                    drawRect(highlight, size = Size(CURRENT_MARK.toPx(), size.height), topLeft = Offset.Zero)
                }
            }

            CodeLineTone.Editable -> {
                Modifier.background(colors.surface, shape).border(1.dp, MaterialTheme.zoonk.vizAccent.copy(alpha = EDGE_ALPHA), shape)
            }

            CodeLineTone.Error -> {
                Modifier.background(colors.error.copy(alpha = SOFT_ALPHA), shape)
            }
        }
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .then(toned)
            .padding(end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            number.toString().padStart(digits),
            Modifier
                .padding(start = 4.dp, end = 12.dp)
                .clearAndSetSemantics {},
            color = colors.onSurfaceVariant,
            style = codeTextStyle(),
        )
        content()
    }
}

private data class Highlighting(
    private val language: CodeLanguage,
    private val palette: CodePalette,
) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val annotated =
            buildAnnotatedString {
                highlightCode(text.text, language).forEachIndexed { index, tokens ->
                    if (index > 0) append('\n')
                    append(palette.styled(tokens))
                }
            }
        return TransformedText(annotated, OffsetMapping.Identity)
    }
}

internal val codeKeyboard =
    KeyboardOptions(capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, keyboardType = KeyboardType.Ascii)

private fun KeyEvent.isEnter() = key == Key.Enter || key == Key.NumPadEnter

/** Main's `ActivityCodeLineInput`: one line of code to edit in place; Enter runs the program. */
@Composable
internal fun CodeLineField(
    value: String,
    onValueChange: (String) -> Unit,
    language: CodeLanguage,
    label: String,
    readOnly: Boolean,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .semantics { contentDescription = label }
                .onPreviewKeyEvent { event ->
                    if (event.isEnter() && event.type == KeyEventType.KeyDown) onSubmit()
                    event.isEnter()
                },
        readOnly = readOnly,
        textStyle = codeTextStyle().copy(color = MaterialTheme.colorScheme.onSurface),
        keyboardOptions = codeKeyboard,
        singleLine = true,
        visualTransformation = Highlighting(language, codePalette()),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        decorationBox = { field -> Box(contentAlignment = Alignment.CenterStart) { field() } },
    )
}

/**
 * Main's `SandboxRunBar`: Run is the main action until the first run, then steps back so Check
 * stands out. Runs wait for the runtime, so Run works while it loads.
 */
@Composable
internal fun SandboxRunBar(
    runtimeName: String,
    runtime: SandboxRuntime,
    hasRun: Boolean,
    isRunning: Boolean,
    onRun: () -> Unit,
    onReset: (() -> Unit)? = null,
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
                val reset = stringResource(R.string.activities_code_start_over)
                OutlinedIconButton(onClick = onReset, Modifier.size(48.dp).semantics { contentDescription = reset }, enabled = !isRunning) {
                    Icon(painterResource(R.drawable.ic_replay), contentDescription = null)
                }
            }
            val content: @Composable RowScope.() -> Unit = {
                if (isRunning) {
                    CircularProgressIndicator(Modifier.size(18.dp), color = LocalContentColor.current, strokeWidth = 2.dp)
                } else {
                    Icon(painterResource(R.drawable.ic_play_arrow), contentDescription = null, Modifier.size(18.dp))
                }
                Text(
                    stringResource(
                        when {
                            isRunning -> R.string.activities_code_running
                            hasRun -> R.string.activities_code_run_again
                            else -> R.string.activities_code_run
                        },
                    ),
                    Modifier.padding(start = 8.dp),
                )
            }
            val runModifier = Modifier.weight(1f).heightIn(min = 48.dp)
            if (hasRun) {
                OutlinedButton(onClick = onRun, modifier = runModifier, enabled = !isRunning, content = content)
            } else {
                Button(onClick = onRun, modifier = runModifier, enabled = !isRunning, content = content)
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

private val CURRENT_MARK = 3.dp
internal const val SOFT_ALPHA = 0.12f
private const val EDGE_ALPHA = 0.4f
