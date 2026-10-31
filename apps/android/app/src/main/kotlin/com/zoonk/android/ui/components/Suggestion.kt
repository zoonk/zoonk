package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk

/** A line that opens its content in a sheet (beside nothing), or its content in full (beside the page). */
enum class SuggestionLayout { Line, Panel }

sealed interface SuggestionMark {
    /** Something new to know or decide. */
    data object New : SuggestionMark

    data object Done : SuggestionMark

    data class Symbol(
        @DrawableRes val icon: Int,
    ) : SuggestionMark
}

/**
 * Main's `Suggestion`: one thing to know or decide. As a [SuggestionLayout.Line] it shows [summary]
 * and [lineAction], by default "View", which opens [content] in a bottom sheet titled [label]; as a
 * [SuggestionLayout.Panel] it shows [content] in full. Once [answered], [summary] is the answer's
 * result, read out when it shows, an open sheet closes, and a keyboard's or screen reader's focus
 * moves to it, as the control they used is gone.
 */
@Composable
fun Suggestion(
    label: String,
    summary: String,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
    mark: SuggestionMark = SuggestionMark.New,
    answered: Boolean = false,
    lineAction: (@Composable () -> Unit)? = { SuggestionOpen() },
    content: @Composable SuggestionContentScope.() -> Unit,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    var settled by remember { mutableStateOf(answered) }
    val focus = remember { FocusRequester() }
    val sheetFocus = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()
    val frame = remember(mark) { Frame(mark, focus, sheetFocus) { open = true } }

    LaunchedEffect(answered) {
        if (answered) open = false
        if (answered && !settled) moveFocus(focus)
        settled = answered
    }

    CompositionLocalProvider(LocalFrame provides frame) {
        when (layout) {
            SuggestionLayout.Line -> {
                SuggestionLine(summary, answered, modifier, lineAction)
                if (open) SuggestionSheet(label, onClose = { open = false }, onFocus = { moveFocus(sheetFocus) }, content)
            }

            SuggestionLayout.Panel -> {
                val framing = LocalFraming.current
                val top = if (framing == Framing.Headed) 0.dp else 16.dp
                val panel =
                    @Composable {
                        CompositionLocalProvider(LocalPresentation provides Presentation.Panel) {
                            Column(
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp, top = top),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                SuggestionContentScope(this, close = { open = false }, focus = { moveFocus(focus) }).content()
                            }
                        }
                    }
                if (framing == Framing.Own) {
                    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, border = frameBorder(), content = panel)
                } else {
                    Box(modifier.fillMaxWidth()) { panel() }
                }
            }
        }
    }
}

/** A panel's frame around a [Suggestion] and the [head] above it, say a pager; the suggestion draws no frame of its own. */
@Composable
fun SuggestionFrame(
    modifier: Modifier = Modifier,
    head: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, border = frameBorder()) {
        Column {
            head?.invoke()
            CompositionLocalProvider(LocalFraming provides if (head != null) Framing.Headed else Framing.Shared, content = content)
        }
    }
}

/**
 * The suggestion's content, which [close]s its sheet, say before leaving for another page, and
 * moves a keyboard's or screen reader's [focus] to its header, say once the control used gives way.
 */
@Stable
class SuggestionContentScope internal constructor(
    column: ColumnScope,
    val close: () -> Unit,
    val focus: () -> Unit,
) : ColumnScope by column

@Composable
fun SuggestionOpen(text: String = stringResource(R.string.suggestion_view)) {
    FilledTonalButton(onClick = LocalFrame.current.open) { Text(text) }
}

@Composable
fun SuggestionHeader(text: String) {
    val sheet = LocalPresentation.current == Presentation.Sheet
    val frame = LocalFrame.current
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Mark(if (sheet) SHEET_MARK else PANEL_MARK)
        Text(
            text = text,
            modifier =
                Modifier
                    .focusRequester(if (sheet) frame.sheetFocus else frame.focus)
                    .focusable()
                    .semantics { heading() },
            style = if (sheet) MaterialTheme.typography.titleMedium else MaterialTheme.typography.titleSmall,
        )
    }
}

@Composable
fun SuggestionDescription(
    text: String,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Text(text = text, style = bodyStyle(), color = color)
}

@Composable
fun SuggestionResult(text: String) {
    Text(
        text = text,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = bodyStyle(),
        fontWeight = FontWeight.Medium,
    )
}

@Composable
fun SuggestionSaveError() {
    Text(
        text = stringResource(R.string.suggestion_save_failed),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
    )
}

/** Side by side in a panel; one under another, full width, in a sheet. */
@Composable
fun SuggestionActions(content: @Composable () -> Unit) {
    if (LocalPresentation.current == Presentation.Sheet) {
        Column(Modifier.fillMaxWidth().padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    } else {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

/** On a line it's always [secondary], beside the summary. */
@Composable
fun SuggestionAction(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    secondary: Boolean = false,
) = SuggestionAction(onClick, enabled = enabled, secondary = secondary) { Text(text) }

/** [content] is the button's label, say with a spinner while its work runs. */
@Composable
fun SuggestionAction(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    secondary: Boolean = false,
    content: @Composable RowScope.() -> Unit,
) {
    val presentation = LocalPresentation.current
    val width = if (presentation == Presentation.Sheet) Modifier.fillMaxWidth() else Modifier

    if (secondary || presentation == Presentation.Line) {
        FilledTonalButton(onClick = onClick, modifier = modifier.then(width), enabled = enabled, content = content)
    } else {
        Button(onClick = onClick, modifier = modifier.then(width), enabled = enabled, content = content)
    }
}

@Composable
private fun SuggestionLine(
    summary: String,
    answered: Boolean,
    modifier: Modifier,
    action: (@Composable () -> Unit)?,
) {
    // With nothing to open, the line is all there is to read.
    val whole = answered || action == null
    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, border = frameBorder()) {
        CompositionLocalProvider(LocalPresentation provides Presentation.Line) {
            Row(
                modifier = Modifier.heightIn(min = 56.dp).padding(start = 12.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Mark(PANEL_MARK)
                Text(
                    text = summary,
                    modifier =
                        Modifier
                            .weight(1f)
                            .focusRequester(LocalFrame.current.focus)
                            .focusable()
                            .then(if (answered) Modifier.semantics { liveRegion = LiveRegionMode.Polite } else Modifier),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (answered) FontWeight.Medium else null,
                    color = if (whole) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = if (whole || LocalDensity.current.fontScale > FULL_SUMMARY_FONT_SCALE) Int.MAX_VALUE else 2,
                    overflow = TextOverflow.Ellipsis,
                )
                action?.invoke()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SuggestionSheet(
    label: String,
    onClose: () -> Unit,
    onFocus: () -> Unit,
    content: @Composable SuggestionContentScope.() -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        CompositionLocalProvider(LocalPresentation provides Presentation.Sheet) {
            Column(
                modifier =
                    Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(start = 24.dp, end = 24.dp, bottom = 32.dp)
                        .semantics { paneTitle = label },
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                SuggestionContentScope(this, onClose, onFocus).content()
            }
        }
    }
}

@Composable
private fun Mark(size: Dp) {
    val colors = MaterialTheme.colorScheme
    val (icon, tint) =
        when (val mark = LocalFrame.current.mark) {
            SuggestionMark.New -> R.drawable.ic_auto_awesome to MaterialTheme.zoonk.warning
            SuggestionMark.Done -> R.drawable.ic_check to colors.tertiary
            is SuggestionMark.Symbol -> mark.icon to colors.onSurfaceVariant
        }
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(size), tint = tint)
}

@Composable
private fun frameBorder() = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)

@Composable
private fun bodyStyle() =
    if (LocalPresentation.current == Presentation.Sheet) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.bodyMedium

private enum class Presentation { Line, Panel, Sheet }

/** Who draws a panel's frame: the suggestion, or a [SuggestionFrame] around it, with or without a head. */
private enum class Framing { Own, Shared, Headed }

/** [focus] is the line's summary or the panel's header; [sheetFocus] the sheet's header. */
private class Frame(
    val mark: SuggestionMark,
    val focus: FocusRequester,
    val sheetFocus: FocusRequester,
    val open: () -> Unit,
)

private val LocalPresentation = staticCompositionLocalOf { Presentation.Panel }
private val LocalFrame = staticCompositionLocalOf { Frame(SuggestionMark.New, FocusRequester(), FocusRequester()) {} }
private val LocalFraming = staticCompositionLocalOf { Framing.Own }

private val PANEL_MARK = 18.dp

/** From here two lines hold only the start of a summary, cutting off its key words. */
private const val FULL_SUMMARY_FONT_SCALE = 1.3f
private val SHEET_MARK = 24.dp
