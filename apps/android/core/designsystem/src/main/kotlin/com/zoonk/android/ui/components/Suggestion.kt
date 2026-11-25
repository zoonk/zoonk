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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
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
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.balanced
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

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
 * moves to it, as the control they used is gone. While [failed], a line reads [failure] in
 * place of [summary], as main's does when its [lineAction] didn't save. [lineDescription] goes under the
 * line's summary, for a suggestion whose line says all there is (main's `SuggestionLine` with a description).
 */
@Composable
fun Suggestion(
    label: String,
    summary: String,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
    mark: SuggestionMark = SuggestionMark.New,
    answered: Boolean = false,
    failed: Boolean = false,
    lineAction: (@Composable () -> Unit)? = { SuggestionOpen() },
    lineDescription: String? = null,
    failure: String = stringResource(R.string.suggestion_save_failed),
    content: @Composable SuggestionContentScope.() -> Unit,
) {
    val held = rememberHeld(mark, answered)
    val frame = held.frame
    val moveFocus = held.moveFocus

    CompositionLocalProvider(LocalFrame provides frame) {
        when (layout) {
            SuggestionLayout.Line -> {
                SuggestionLine(summary, answered, failure.takeIf { failed }, modifier, lineAction, lineDescription)
                if (held.open) SuggestionSheet(label, onClose = held::close, onFocus = { moveFocus(frame.sheetFocus) }, content)
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
                                SuggestionContentScope(this, close = held::close, focus = { moveFocus(frame.focus) }).content()
                            }
                        }
                    }
                if (framing == Framing.Own) {
                    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, border = frameBorder(), content = panel)
                } else {
                    Box(modifier.fillMaxWidth()) { panel() }
                }
            }
        }
    }
}

/**
 * Main's `TodaySuggestionCard`: [card], a [SuggestionHeader] over its reason and the actions, beside the mark in one frame
 * at every width. Its [SuggestionOpen] opens [content] in a bottom sheet titled [label]; with no [content], [card]
 * answers on its own. Once [answered], an open sheet closes and focus moves to the card's [SuggestionResult].
 */
@Composable
fun SuggestionCard(
    label: String,
    modifier: Modifier = Modifier,
    mark: SuggestionMark = SuggestionMark.New,
    answered: Boolean = false,
    card: @Composable SuggestionContentScope.() -> Unit,
    content: (@Composable SuggestionContentScope.() -> Unit)? = null,
) {
    val held = rememberHeld(mark, answered)
    val frame = held.frame
    val focus = { held.moveFocus(frame.focus) }

    CompositionLocalProvider(LocalFrame provides frame) {
        Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, border = frameBorder()) {
            CompositionLocalProvider(LocalPresentation provides Presentation.Card) {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.height(lineHeight(MaterialTheme.typography.titleSmall)), contentAlignment = Alignment.Center) {
                        Mark(PANEL_MARK)
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        SuggestionContentScope(this, close = held::close, focus = focus).card()
                    }
                }
            }
        }
        if (held.open && content != null) {
            SuggestionSheet(label, onClose = held::close, onFocus = { held.moveFocus(frame.sheetFocus) }, content)
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
    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, border = frameBorder()) {
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
    OutlinedButton(onClick = LocalFrame.current.open, size = ButtonSize.Small) { Text(text) }
}

/** [maxLines] cuts words the learner wrote, say a goal they typed, that could run long. */
@Composable
fun SuggestionHeader(
    text: String,
    maxLines: Int = Int.MAX_VALUE,
) {
    val sheet = LocalPresentation.current == Presentation.Sheet
    val frame = LocalFrame.current
    val style = if (sheet) MaterialTheme.zoonkType.sheetTitle else MaterialTheme.zoonkType.compact.copy(fontWeight = FontWeight.SemiBold)
    Text(
        text = text,
        modifier = Modifier.focusRequester(if (sheet) frame.sheetFocus else frame.focus).focusable().semantics { heading() },
        style = style.balanced(),
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
fun SuggestionDescription(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Text(text = text, modifier = modifier, style = descriptionStyle(), color = color)
}

@Composable
fun SuggestionDescription(text: AnnotatedString) {
    Text(text = text, style = descriptionStyle(), color = MaterialTheme.colorScheme.onSurfaceVariant)
}

/** On a [SuggestionCard], what focus moves to once the answer replaces the controls. */
@Composable
fun SuggestionResult(text: String) {
    val card = LocalPresentation.current == Presentation.Card
    Text(
        text = text,
        modifier =
            Modifier
                .then(if (card) Modifier.focusRequester(LocalFrame.current.focus).focusable() else Modifier)
                .semantics { liveRegion = LiveRegionMode.Polite },
        style = resultStyle(),
        fontWeight = FontWeight.Medium,
    )
}

@Composable
fun SuggestionSaveError(text: String = stringResource(R.string.suggestion_save_failed)) {
    Text(
        text = text,
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
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

/**
 * Main's `useMainActionVariant`: the main answer of a suggestion on a page whose bar holds the page's own main
 * action (Today). It fills its sheet, and is outlined on Today's card or a wide screen's side panel so it never competes
 * with the bar.
 */
@Composable
fun SuggestionMainAction(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    busy: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
) = SuggestionAction(
    text,
    onClick,
    enabled = enabled,
    busy = busy,
    secondary = LocalPresentation.current != Presentation.Sheet,
    leadingIcon = leadingIcon,
)

/** On a line it's always [secondary], beside the summary. */
@Composable
fun SuggestionAction(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    busy: Boolean = false,
    secondary: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
) = SuggestionAction(onClick, enabled = enabled, busy = busy, secondary = secondary, leadingIcon = leadingIcon) { Text(text) }

@Composable
fun SuggestionAction(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    secondary: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val presentation = LocalPresentation.current
    val width = if (presentation == Presentation.Sheet) Modifier.fillMaxWidth() else Modifier
    val size = if (presentation == Presentation.Sheet) ButtonSize.Large else ButtonSize.Small

    if (secondary || presentation == Presentation.Line) {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier.then(width),
            enabled = enabled,
            busy = busy,
            size = size,
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            content = content,
        )
    } else {
        Button(
            onClick = onClick,
            modifier = modifier.then(width),
            enabled = enabled,
            busy = busy,
            size = size,
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            content = content,
        )
    }
}

@Composable
private fun SuggestionLine(
    summary: String,
    answered: Boolean,
    failure: String?,
    modifier: Modifier,
    action: (@Composable () -> Unit)?,
    description: String?,
) {
    val failed = failure != null
    // With nothing to open, the line is all there is to read.
    val whole = answered || action == null
    val summaryStyle = if (answered) resultStyle() else MaterialTheme.typography.bodyMedium
    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, border = frameBorder()) {
        CompositionLocalProvider(LocalPresentation provides Presentation.Line) {
            LineLayout(
                modifier = Modifier.heightIn(min = 56.dp).padding(8.dp),
                firstLine = lineHeight(summaryStyle),
                // A line that failed to save shows the alert mark in the done mark's place, as the failure notice does.
                mark = {
                    if (failed && LocalFrame.current.mark == SuggestionMark.Done) {
                        Icon(
                            painterResource(R.drawable.ic_error),
                            contentDescription = null,
                            modifier = Modifier.size(PANEL_MARK * glyphScale()),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Mark(PANEL_MARK)
                    }
                },
                summary = {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = failure ?: summary,
                            modifier =
                                Modifier
                                    .focusRequester(LocalFrame.current.focus)
                                    // A statement (nothing to open, nothing answered) is read, never a stop for the keyboard.
                                    .then(if (whole && !answered && !failed) Modifier else Modifier.focusable())
                                    .then(
                                        when {
                                            failed -> Modifier.semantics { liveRegion = LiveRegionMode.Assertive }
                                            answered -> Modifier.semantics { liveRegion = LiveRegionMode.Polite }
                                            else -> Modifier
                                        },
                                    ),
                            style = summaryStyle.balanced(),
                            fontWeight = FontWeight.Medium,
                            color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                        )
                        description?.let { SuggestionDescription(it) }
                    }
                },
                // The line's actions are one group, beside the summary or under it together.
                action =
                    action?.let {
                        {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                it()
                            }
                        }
                    },
            )
        }
    }
}

/**
 * The mark, the summary and the action side by side, the action at the end while it leaves the summary half the room
 * after the mark and no word of it breaks; otherwise the action goes under the summary's words.
 */
@Composable
private fun LineLayout(
    modifier: Modifier,
    firstLine: Dp,
    mark: @Composable () -> Unit,
    summary: @Composable () -> Unit,
    action: (@Composable () -> Unit)?,
) {
    Layout(contents = listOf(mark, summary, action ?: {}), modifier = modifier) { (markPart, summaryPart, actionPart), constraints ->
        val gap = LINE_GAP.roundToPx()
        val markPlaced = markPart.single().measure(Constraints())
        val textMax = (constraints.maxWidth - markPlaced.width - gap).coerceAtLeast(0)
        val actionPlaced = actionPart.firstOrNull()?.measure(Constraints(maxWidth = textMax))
        val words = summaryPart.single()
        val besideWidth = textMax - (actionPlaced?.let { it.width + gap } ?: 0)
        val stackGap = STACKED_ACTION_GAP.roundToPx()
        val beside =
            actionPlaced == null ||
                (besideWidth >= textMax / 2 && besideWidth >= words.minIntrinsicWidth(constraints.maxHeight))
        val textWidth = if (beside) besideWidth else textMax
        val summaryPlaced = words.measure(Constraints.fixedWidth(textWidth))
        val content =
            when {
                actionPlaced == null -> summaryPlaced.height
                beside -> maxOf(summaryPlaced.height, actionPlaced.height)
                else -> summaryPlaced.height + stackGap + actionPlaced.height
            }
        val height = maxOf(content, markPlaced.height, constraints.minHeight)
        // E5: beside one or two lines the mark is centered on the words, beside three or more on the first line.
        val line = firstLine.roundToPx()
        val onFirstLine = summaryPlaced.height > line * 2 + line / 2
        val markAt = { wordsTop: Int ->
            if (onFirstLine) wordsTop + (line - markPlaced.height) / 2 else wordsTop + (summaryPlaced.height - markPlaced.height) / 2
        }
        layout(constraints.maxWidth, height) {
            val top = (height - content) / 2
            val textStart = markPlaced.width + gap
            if (beside) {
                val wordsTop = (height - summaryPlaced.height) / 2
                markPlaced.placeRelative(0, markAt(wordsTop))
                summaryPlaced.placeRelative(textStart, wordsTop)
                actionPlaced?.placeRelative(constraints.maxWidth - actionPlaced.width, (height - actionPlaced.height) / 2)
            } else {
                markPlaced.placeRelative(0, markAt(top))
                summaryPlaced.placeRelative(textStart, top)
                actionPlaced.placeRelative(textStart, top + summaryPlaced.height + stackGap)
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
    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberExpandedBottomSheetState()) {
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
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(size * glyphScale()), tint = tint)
}

@Composable
private fun frameBorder() = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)

@Composable
private fun resultStyle() =
    if (LocalPresentation.current == Presentation.Sheet) MaterialTheme.zoonkType.sheetText else MaterialTheme.zoonkType.compact

/** Main's `SuggestionDescription`: a line's size in its line, reading size in its sheet, a row description's on the page. */
@Composable
private fun descriptionStyle() =
    when (LocalPresentation.current) {
        Presentation.Line -> MaterialTheme.zoonkType.compact
        Presentation.Sheet -> MaterialTheme.zoonkType.sheetText
        Presentation.Panel, Presentation.Card -> MaterialTheme.typography.bodySmall
    }

private enum class Presentation { Line, Panel, Card, Sheet }

/** Whether a suggestion's sheet is open, closed once it's [answered], when focus moves to [Frame.focus] as the control used is gone. */
@Stable
private class Held(
    val frame: Frame,
    private val opened: MutableState<Boolean>,
    val moveFocus: (FocusRequester) -> Unit,
) {
    val open get() = opened.value

    fun close() {
        opened.value = false
    }
}

@Composable
private fun rememberHeld(
    mark: SuggestionMark,
    answered: Boolean,
): Held {
    val opened = rememberSaveable { mutableStateOf(false) }
    var settled by remember { mutableStateOf(answered) }
    val moveFocus = rememberMoveFocus()
    val focus = remember { FocusRequester() }
    val sheetFocus = remember { FocusRequester() }
    val frame = remember(mark) { Frame(mark, focus, sheetFocus) { opened.value = true } }

    LaunchedEffect(answered) {
        if (answered) opened.value = false
        if (answered && !settled) moveFocus(focus)
        settled = answered
    }

    return remember(frame, moveFocus) { Held(frame, opened, moveFocus) }
}

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
private val LINE_GAP = 10.dp
private val STACKED_ACTION_GAP = 8.dp

private val SHEET_MARK = 24.dp

/** Main's `SuggestionMenu`: "Other options", a quiet button for a suggestion's other ways on; each [SuggestionMenuItem] closes it with done before acting. */
@Composable
fun SuggestionMenu(options: @Composable (done: () -> Unit) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }

    Box {
        SuggestionAction(
            onClick = { open = true },
            modifier = Modifier.semantics { role = Role.DropdownList },
            secondary = true,
            trailingIcon = { ButtonIcon(R.drawable.ic_expand_more) },
        ) {
            Text(stringResource(R.string.suggestion_other_options))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) { options { open = false } }
    }
}

@Composable
fun SuggestionMenuItem(
    text: String,
    done: () -> Unit,
    onClick: () -> Unit,
) {
    DropdownMenuItem(text = { Text(text) }, onClick = {
        done()
        onClick()
    })
}
