package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LIFTED_ELEVATION
import com.zoonk.android.feature.activities.detectLift
import com.zoonk.android.feature.activities.orderAnswer
import com.zoonk.android.feature.activities.orderIds
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.roundToInt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf22Value as TimelineContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheck

val timelineRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_place_in_time, R.drawable.ic_height) },
        canvas = { TimelineActivity(it) },
    )

private data class Dated(
    val label: String,
    val year: Long,
)

private data class TrackEvent(
    val id: String,
    val label: String,
    val guess: Long,
    val year: Long,
    val isRevealed: Boolean,
    val isRight: Boolean?,
)

private class TrackAxis(
    val start: Long,
    val end: Long,
    val height: Dp,
) {
    fun yOf(
        year: Long,
        density: Float,
    ): Float {
        val span = (end - start).takeIf { it != 0L } ?: 1L
        val inset = TRACK_INSET.value * density
        return inset + (year - start).toFloat() / span * (height.value * density - inset * 2)
    }
}

@Composable
private fun TimelineActivity(props: ActivityProps) {
    val content = (props.content as TimelineContent).value
    val fields = content.fields
    val isQuestion = content.check is ChoiceCheck
    var placements by rememberSaveable(stateSaver = PlacementsSaver) { mutableStateOf(emptyList<Pair<String, Long>>()) }
    var revealed by rememberSaveable { mutableStateOf(false) }
    var dragId by remember { mutableStateOf<String?>(null) }
    var focusId by remember { mutableStateOf<String?>(null) }
    val focus = remember(fields) { fields.events.associate { it.id to FocusRequester() } }
    val formatYear = rememberYearFormat(fields.start)
    val showTruth = revealed || props.isChecked
    val order = if (placements.isEmpty()) props.answer.orderIds.orEmpty() else placedOrder(placements)
    val expected = props.expected.orderIds
    val unplaced = fields.events.filter { event -> placements.none { it.first == event.id } }
    val trayEvent = fields.events.firstOrNull { it.id == dragId } ?: unplaced.firstOrNull()
    val step = yearStep(fields.start, fields.end)

    fun place(
        id: String,
        year: Long?,
    ) {
        val next =
            when {
                year == null -> placements.filter { it.first != id }
                placements.any { it.first == id } -> placements.map { if (it.first == id) id to year else it }
                else -> placements + (id to year)
            }
        placements = next
        if (!isQuestion) props.onAnswerChange(if (next.size == fields.events.size) orderAnswer(placedOrder(next)) else null)
    }

    LaunchedEffect(focusId) { focusId?.let { focus[it]?.requestFocus() } }

    val events =
        fields.events.mapNotNull { event ->
            val guess = placements.firstOrNull { it.first == event.id }?.second
            if (guess == null && !props.isChecked) return@mapNotNull null
            TrackEvent(
                id = event.id,
                label = event.label,
                guess = guess ?: event.year,
                year = event.year,
                isRevealed = showTruth,
                isRight = expected?.takeIf { props.isChecked }?.let { it.indexOf(event.id) == order.indexOf(event.id) },
            )
        }

    ActivityCanvas {
        var track by remember { mutableStateOf<LayoutCoordinates?>(null) }
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val fontScale = LocalDensity.current.fontScale
            val gutter = rememberTrackGutter(fields.start, fields.end, formatYear)
            val labels = (fields.anchors.map { it.label } + fields.events.map { it.label })
            val gap = cardGap(labels, maxWidth, fontScale, gutter)
            val axis = TrackAxis(fields.start, fields.end, max(MIN_HEIGHT.value, gap.value * (labels.size + 1)).dp)
            TimelineTrack(
                axis = axis,
                anchors = fields.anchors.map { Dated(it.label, it.year) },
                events = events,
                cardGap = gap,
                gutter = gutter,
                width = maxWidth,
                step = step,
                movable = !props.isLocked && !showTruth,
                formatYear = formatYear,
                focus = focus,
                onTrack = { track = it },
                onMove = ::place,
            )
        }

        if (!props.isChecked && trayEvent != null) {
            TimelineTray(
                label = trayEvent.label,
                remaining = unplaced.size,
                enabled = !props.isLocked,
                onPlace = {
                    place(trayEvent.id, snapYear((fields.start + fields.end) / 2.0, fields.start, fields.end))
                    focusId = trayEvent.id
                },
                onDrag = { trayCoordinates, point, density ->
                    dragId = trayEvent.id
                    val bounds = track
                    val at = bounds?.takeIf { it.isAttached }?.localPositionOf(trayCoordinates, point)
                    val inside = at != null && at.x >= 0 && at.y >= 0 && at.x <= bounds.size.width && at.y <= bounds.size.height
                    place(trayEvent.id, if (inside) yearAtOf(fields.start, fields.end, bounds, at.y, density) else null)
                },
                onDragEnd = { drops ->
                    if (!drops) place(trayEvent.id, null)
                    dragId = null
                },
            )
        }

        if (isQuestion && !showTruth && unplaced.isEmpty()) {
            OutlinedButton(onClick = { revealed = true }, enabled = !props.isLocked) {
                Text(stringResource(R.string.activities_sorting_show_real_dates))
            }
        }

        if (showTruth) {
            TimelineGaps(
                (fields.anchors.map { Dated(it.label, it.year) } + fields.events.map { Dated(it.label, it.year) }),
                formatYear,
            )
        }
    }
}

private fun yearAtOf(
    start: Long,
    end: Long,
    track: LayoutCoordinates,
    y: Float,
    density: Float,
): Long {
    val height = track.size.height.toFloat()
    val inset = TRACK_INSET.value * density
    val share = (y - inset) / (height - inset * 2)
    return snapYear(start + share.toDouble() * (end - start), start, end)
}

/** Where the axis and the cards start: after the widest year on the axis, so its era always shows. */
private class TrackGutter(
    val tickRight: Dp,
) {
    val axisX = tickRight + TICK_GAP
    val cardLeft = axisX + CARD_GAP
}

@Composable
private fun rememberTrackGutter(
    start: Long,
    end: Long,
    formatYear: (Long) -> String,
): TrackGutter {
    val measurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelSmall.withTabularFigures()
    val density = LocalDensity.current
    val widest = yearTicks(start, end).maxOfOrNull { measurer.measure(formatYear(it), style).size.width } ?: 0
    return TrackGutter(maxOf(TICK_RIGHT, with(density) { widest.toDp() }))
}

/** Main's estimate of a card's height from its longest label, so cards spread far enough apart. */
private fun cardGap(
    labels: List<String>,
    width: Dp,
    fontScale: Float,
    gutter: TrackGutter,
): Dp {
    val longest = labels.maxOfOrNull { it.length } ?: 1
    val chrome = gutter.cardLeft.value + CARD_PADDING
    val lines = ceil(longest * CHARACTER_WIDTH * fontScale / max(width.value - chrome, 1f)).toInt()
    return ((CARD_BASE + LINE_HEIGHT * max(lines, 1)) * fontScale).dp
}

@Composable
private fun rememberYearFormat(start: Long): (Long) -> String {
    val locale = currentLocale()
    val bce = stringResource(R.string.activities_sorting_year_bce)
    val ce = stringResource(R.string.activities_sorting_year_ce)
    return { year ->
        val (value, era) = yearLabel(year, start)
        val number = formatNumber(value.toDouble(), locale, grouping = false)
        when (era) {
            Era.Bce -> bce.format(number)
            Era.Ce -> ce.format(number)
            null -> number
        }
    }
}

@Composable
private fun TimelineTrack(
    axis: TrackAxis,
    anchors: List<Dated>,
    events: List<TrackEvent>,
    cardGap: Dp,
    gutter: TrackGutter,
    width: Dp,
    step: Long,
    movable: Boolean,
    formatYear: (Long) -> String,
    focus: Map<String, FocusRequester>,
    onTrack: (LayoutCoordinates) -> Unit,
    onMove: (String, Long?) -> Unit,
) {
    val density = LocalDensity.current.density
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val shown = anchors.map { it.year } + events.map { if (it.isRevealed) it.year else it.guess }
    val cardYs =
        spreadLabels(
            shown.map { axis.yOf(it, density) },
            gap = cardGap.value * density,
            top = cardGap.value * density / 2,
            bottom = (axis.height.value - cardGap.value / 2) * density,
        )
    val colors = trackColors()
    val description = stringResource(R.string.activities_sorting_timeline_from, formatYear(axis.start), formatYear(axis.end))
    var coordinates by remember { mutableStateOf<LayoutCoordinates?>(null) }

    Box(
        Modifier
            .fillMaxWidth()
            .height(axis.height)
            .onGloballyPositioned {
                coordinates = it
                onTrack(it)
            }.semantics { contentDescription = description }
            .drawBehind { drawTrack(axis, gutter, anchors, events, cardYs, colors, rtl) },
    ) {
        yearTicks(axis.start, axis.end).forEach { tick ->
            Text(
                formatYear(tick),
                Modifier
                    .width(gutter.tickRight)
                    .centeredAt(axis.yOf(tick, density))
                    .clearAndSetSemantics {},
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                textAlign = TextAlign.End,
                maxLines = 1,
            )
        }
        anchors.forEachIndexed { index, anchor ->
            AnchorCard(
                anchor,
                formatYear,
                Modifier.padding(start = gutter.cardLeft).width(width - gutter.cardLeft).centeredAt(cardYs[index]),
            )
        }
        events.forEachIndexed { index, event ->
            EventCard(
                event = event,
                start = axis.start,
                end = axis.end,
                step = step,
                movable = movable && !event.isRevealed,
                formatYear = formatYear,
                onMove = { onMove(event.id, it) },
                yearAt = { cardCoordinates, point ->
                    coordinates?.takeIf { it.isAttached }?.let {
                        yearAtOf(
                            axis.start,
                            axis.end,
                            it,
                            it.localPositionOf(cardCoordinates, point).y,
                            density,
                        )
                    }
                },
                modifier =
                    Modifier
                        .padding(start = gutter.cardLeft)
                        .width(width - gutter.cardLeft)
                        .centeredAt(cardYs[anchors.size + index])
                        .then(focus[event.id]?.let { Modifier.focusRequester(it) } ?: Modifier),
            )
        }
    }
}

/** Places this child with its center at [y] in the box. */
private fun Modifier.centeredAt(y: Float) =
    layout { measurable, constraints ->
        val placeable = measurable.measure(constraints)
        layout(placeable.width, placeable.height) { placeable.place(0, (y - placeable.height / 2f).roundToInt()) }
    }

private data class TrackColors(
    val axis: Color,
    val ink: Color,
    val background: Color,
    val accent: Color,
    val highlight: Color,
    val secondary: Color,
)

@Composable
private fun trackColors() =
    TrackColors(
        axis = MaterialTheme.colorScheme.outlineVariant,
        ink = MaterialTheme.colorScheme.onSurface,
        background = MaterialTheme.colorScheme.surface,
        accent = MaterialTheme.zoonk.vizAccent,
        highlight = MaterialTheme.zoonk.vizHighlight,
        secondary = MaterialTheme.zoonk.vizSecondary,
    )

/** Main's track: the axis, the spans between known dates, each date's dot and the line to its card. */
private fun DrawScope.drawTrack(
    axis: TrackAxis,
    gutter: TrackGutter,
    anchors: List<Dated>,
    events: List<TrackEvent>,
    cardYs: List<Float>,
    colors: TrackColors,
    rtl: Boolean,
) {
    val x = { dp: Dp -> if (rtl) size.width - dp.toPx() else dp.toPx() }
    val y = { year: Long -> axis.yOf(year, density) }
    val axisX = x(gutter.axisX)
    drawLine(colors.axis, Offset(axisX, y(axis.start)), Offset(axisX, y(axis.end)), strokeWidth = 2.dp.toPx())

    val known = (anchors.map { it.year } + events.filter { it.isRevealed }.map { it.year }).sorted()
    known.zipWithNext().forEachIndexed { index, (from, to) ->
        drawLine(
            if (index % 2 == 0) colors.highlight else colors.secondary,
            Offset(axisX, y(from)),
            Offset(axisX, y(to)),
            strokeWidth = 4.dp.toPx(),
            cap = StrokeCap.Round,
        )
    }

    val items = anchors.map { it.year to null } + events.map { (if (it.isRevealed) it.year else it.guess) to it }
    val dot = DOT_RADIUS.toPx()
    val dash = { on: Dp, off: Dp -> PathEffect.dashPathEffect(floatArrayOf(on.toPx(), off.toPx())) }
    items.forEachIndexed { index, (year, event) ->
        val dotY = y(year)
        val guessing = event != null && !event.isRevealed
        if (event != null && event.isRevealed && event.guess != event.year) {
            val guessY = y(event.guess)
            drawLine(
                colors.accent.copy(alpha = HALF),
                Offset(axisX, guessY),
                Offset(axisX, dotY),
                2.dp.toPx(),
                pathEffect = dash(3.dp, 3.dp),
            )
            drawCircle(colors.background, dot - 1.dp.toPx(), Offset(axisX, guessY))
            drawCircle(colors.accent, dot - 1.dp.toPx(), Offset(axisX, guessY), style = Stroke(2.dp.toPx()))
        }
        drawLine(
            if (guessing) colors.accent else colors.axis,
            Offset(axisX + if (rtl) -dot else dot, dotY),
            Offset(x(gutter.cardLeft), cardYs[index]),
            1.5.dp.toPx(),
            pathEffect = if (guessing) dash(4.dp, 3.dp) else null,
        )
        drawCircle(colors.background, dot + 1.5.dp.toPx(), Offset(axisX, dotY))
        drawCircle(if (guessing) colors.accent else colors.ink, dot, Offset(axisX, dotY))
    }
}

@Composable
private fun AnchorCard(
    anchor: Dated,
    formatYear: (Long) -> String,
    modifier: Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .heightIn(min = 48.dp)
            .background(MaterialTheme.colorScheme.surface, shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            formatYear(anchor.year),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelSmall.withTabularFigures(),
        )
        Text(anchor.label, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Main's event card, a slider along the axis: dragged, moved by the arrow keys, or set by TalkBack. */
@Composable
private fun EventCard(
    event: TrackEvent,
    start: Long,
    end: Long,
    step: Long,
    movable: Boolean,
    formatYear: (Long) -> String,
    onMove: (Long?) -> Unit,
    yearAt: (LayoutCoordinates, Offset) -> Long?,
    modifier: Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val shape = RoundedCornerShape(12.dp)
    val haptics = LocalHapticFeedback.current
    var card by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var liftedFrom by remember { mutableStateOf<Long?>(null) }
    var focused by remember { mutableStateOf(false) }
    val value =
        if (event.isRevealed) {
            stringResource(R.string.activities_sorting_year_and_guess, formatYear(event.year), formatYear(event.guess))
        } else {
            formatYear(event.guess)
        }
    val border =
        when {
            liftedFrom != null || focused -> colors.primary
            movable -> accent
            event.isRight == false -> colors.error
            event.isRight == true -> colors.tertiary
            else -> colors.outlineVariant
        }
    val moveTo = { year: Long -> if (movable) onMove(year.coerceIn(start, end)) }
    val current by rememberUpdatedState(event)
    val move by rememberUpdatedState(moveTo)
    val at by rememberUpdatedState(yearAt)

    Row(
        modifier
            .heightIn(min = 48.dp)
            .onGloballyPositioned { card = it }
            .graphicsLayer {
                shadowElevation = if (liftedFrom != null) LIFTED_ELEVATION.toPx() else 0f
                this.shape = shape
            }.clip(shape)
            .background(colors.surface)
            .border(if (liftedFrom != null || focused) 2.dp else 1.dp, border, shape)
            .semantics(mergeDescendants = true) {
                contentDescription = event.label
                stateDescription = value
                progressBarRangeInfo =
                    ProgressBarRangeInfo(
                        (if (event.isRevealed) event.year else event.guess).toFloat(),
                        start.toFloat()..end.toFloat(),
                        steps = ((end - start) / step - 1).toInt().coerceAtLeast(0),
                    )
                if (movable) {
                    setProgress { target -> true.also { moveTo(snapYear(target.toDouble(), start, end)) } }
                } else {
                    disabled()
                }
            }.then(
                if (movable) {
                    Modifier
                        .onKeyEvent { key ->
                            if (key.type != KeyEventType.KeyDown) return@onKeyEvent false
                            val next =
                                when (key.key) {
                                    Key.MoveHome -> start
                                    Key.MoveEnd -> end
                                    else -> KEY_STEPS[key.key]?.let { event.guess + it * step }
                                } ?: return@onKeyEvent false
                            moveTo(next)
                            true
                        }.onFocusChanged { focused = it.isFocused }
                        .focusable()
                        .pointerInput(event.id) {
                            detectLift(
                                onLift = {
                                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                    liftedFrom = current.guess
                                },
                                onMove = { point -> card?.let { at(it, point) }?.let(move) },
                                onEnd = { drops ->
                                    if (!drops) liftedFrom?.let(move)
                                    liftedFrom = null
                                },
                            )
                        }
                } else {
                    Modifier
                },
            ).padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                formatYear(if (event.isRevealed) event.year else event.guess),
                color = if (event.isRevealed) colors.onSurface else accent,
                style =
                    MaterialTheme.typography.labelSmall
                        .withTabularFigures()
                        .copy(fontWeight = FontWeight.SemiBold),
            )
            Text(event.label, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
            if (event.isRevealed) {
                Text(
                    stringResource(R.string.activities_sorting_your_guess, formatYear(event.guess)),
                    color = colors.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                )
            }
        }
        when {
            movable -> TrackIcon(R.drawable.ic_drag_indicator, colors.onSurfaceVariant)
            event.isRight == true -> TrackIcon(R.drawable.ic_check, colors.tertiary)
            event.isRight == false -> TrackIcon(R.drawable.ic_close, colors.error)
        }
    }
}

@Composable
private fun TrackIcon(
    icon: Int,
    tint: Color,
) {
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(16.dp), tint = tint)
}

@Composable
private fun TimelineTray(
    label: String,
    remaining: Int,
    enabled: Boolean,
    onPlace: () -> Unit,
    onDrag: (LayoutCoordinates, Offset, Float) -> Unit,
    onDragEnd: (drops: Boolean) -> Unit,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val shape = RoundedCornerShape(12.dp)
    var coordinates by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var held by remember { mutableStateOf(false) }
    val density = LocalDensity.current.density
    val haptics = LocalHapticFeedback.current
    val drag by rememberUpdatedState(onDrag)
    val end by rememberUpdatedState(onDragEnd)
    val placeLabel = stringResource(R.string.activities_sorting_place_on_timeline, label)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            pluralStringResource(R.plurals.activities_sorting_events_to_place, remaining, remaining),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .onGloballyPositioned { coordinates = it }
                .then(
                    if (enabled) {
                        Modifier.pointerInput(Unit) {
                            detectLift(
                                onLift = {
                                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                    held = true
                                },
                                onMove = { point -> coordinates?.let { drag(it, point, density) } },
                                onEnd = { drops ->
                                    held = false
                                    end(drops)
                                },
                            )
                        }
                    } else {
                        Modifier
                    },
                ).graphicsLayer {
                    shadowElevation = if (held) LIFTED_ELEVATION.toPx() else 0f
                    this.shape = shape
                }.clip(shape)
                .background(MaterialTheme.colorScheme.surface)
                .then(if (held) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, shape) else Modifier.dashedOutline(accent, 2.dp))
                .clickable(enabled = enabled, role = Role.Button, onClick = onPlace)
                .semantics { contentDescription = placeLabel }
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TrackIcon(R.drawable.ic_drag_indicator, MaterialTheme.colorScheme.onSurfaceVariant)
            Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
        }
        Text(
            stringResource(R.string.activities_sorting_drag_onto_timeline),
            Modifier.clearAndSetSemantics {},
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun TimelineGaps(
    dates: List<Dated>,
    formatYear: (Long) -> String,
) {
    val locale = currentLocale()
    val sorted = dates.sortedBy { it.year }
    val label = stringResource(R.string.activities_sorting_time_between)
    val highlight = MaterialTheme.zoonk.vizHighlight
    val secondary = MaterialTheme.zoonk.vizSecondary

    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        sorted.zipWithNext().forEachIndexed { index, (earlier, later) ->
            val years = yearsBetween(earlier.year, later.year)
            val rounded = roundedGap(years)
            val count = formatNumber(rounded.toDouble(), locale)
            val gap =
                if (rounded == years) {
                    pluralStringResource(R.plurals.activities_sorting_years, rounded.toInt(), count)
                } else {
                    pluralStringResource(R.plurals.activities_sorting_about_years, rounded.toInt(), count)
                }
            Row(Modifier.semantics(mergeDescendants = true) {}, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    Modifier
                        .padding(top = 6.dp)
                        .size(10.dp)
                        .background(if (index % 2 == 0) highlight else secondary, CircleShape),
                )
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(gap) }
                        append(" ")
                        withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant)) {
                            append(
                                stringResource(
                                    R.string.activities_sorting_gap_between,
                                    earlier.label,
                                    formatYear(earlier.year),
                                    later.label,
                                    formatYear(later.year),
                                ),
                            )
                        }
                    },
                    style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                )
            }
        }
    }
}

private val PlacementsSaver =
    listSaver<List<Pair<String, Long>>, String>(
        save = { placements -> placements.flatMap { listOf(it.first, it.second.toString()) } },
        restore = { saved -> saved.chunked(2).map { (id, year) -> id to year.toLong() } },
    )

private val KEY_STEPS =
    mapOf(
        Key.DirectionDown to 1,
        Key.DirectionRight to 1,
        Key.DirectionUp to -1,
        Key.DirectionLeft to -1,
        Key.PageDown to 10,
        Key.PageUp to -10,
    )

private val TRACK_INSET = 20.dp
private val TICK_RIGHT = 68.dp
private val TICK_GAP = 12.dp
private val CARD_GAP = 20.dp
private val DOT_RADIUS = 6.dp
private val MIN_HEIGHT = 320.dp
private const val CHARACTER_WIDTH = 7.2f
private const val CARD_PADDING = 54f
private const val LINE_HEIGHT = 20f
private const val CARD_BASE = 34f
private const val HALF = 0.5f
