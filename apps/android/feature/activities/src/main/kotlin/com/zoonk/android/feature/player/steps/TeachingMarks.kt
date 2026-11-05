package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.richtext.plainText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LessonIcon
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.StepMarks
import kotlin.math.cos
import kotlin.math.sin

/** A knowledge lesson's marking: its map, which the strip and the opening scene draw. Language lessons have none. */
@Immutable
internal data class LessonMarking(
    val map: LessonMap?,
)

/**
 * A lesson's icon, drawn from the smaller file when that's sharp enough. It's decorative, since the
 * words beside it say the same thing, and its room stays empty while it loads or when it can't.
 */
@Composable
internal fun LessonIconImage(
    icon: LessonIcon,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val sharpFromSmall = with(LocalDensity.current) { size.toPx() <= SMALL_ICON_PIXELS }
    AsyncImage(
        model = if (sharpFromSmall) icon.smallUrl else icon.url,
        contentDescription = null,
        modifier = modifier.size(size),
    )
}

/**
 * Where a teaching screen or question sits in the lesson (concept 3's strip): its idea's place
 * among the map's ideas, drawn small, "Idea 2 of 4", its name and its icon. Nothing when the screen
 * names no idea of [map].
 */
@Composable
internal fun IdeaStrip(
    map: LessonMap?,
    marks: StepMarks?,
) {
    val index = marks?.ideaIndex?.toInt()?.takeIf { map != null && it in map.ideas.indices } ?: return
    val ideas = map?.ideas ?: return
    val idea = ideas[index]

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IdeasDrawing(ideas.size, index, nested = map.shape == LessonMap.Shape.NESTED, Modifier.size(STRIP_DRAWING))
            Column(Modifier.weight(1f)) {
                Text(
                    stringResource(R.string.player_idea_position, count(index + 1), count(ideas.size)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
                idea.label?.let { Text(it, style = MaterialTheme.typography.titleMedium) }
            }
            // The icon's room is kept while it's drawn, so its arrival never moves the name.
            Box(Modifier.size(STRIP_ICON)) { idea.icon?.let { LessonIconImage(it, STRIP_ICON) } }
        }
        HorizontalDivider()
    }
}

/**
 * Where each of [count] ideas sits around the lesson's hub, x and y from -1 to 1: the strip's
 * drawing and the opening map put them in the same places, the first at the top start corner.
 */
internal fun hubPoints(
    count: Int,
    layoutDirection: LayoutDirection,
): List<Offset> {
    val start =
        when (count) {
            2 -> 180.0
            3 -> -150.0
            4 -> -135.0
            else -> -90.0
        }
    val mirror = if (layoutDirection == LayoutDirection.Rtl) -1f else 1f

    return List(count) { index ->
        val angle = Math.toRadians(start + 360.0 / count * index)
        Offset(cos(angle).toFloat() * mirror, sin(angle).toFloat())
    }
}

/** The lesson's ideas drawn small, with the learner's place on [current]: spokes around a hub, or rings inside rings for a nested map. */
@Composable
private fun IdeasDrawing(
    count: Int,
    current: Int,
    nested: Boolean,
    modifier: Modifier,
) {
    val line = MaterialTheme.colorScheme.outline
    val place = MaterialTheme.colorScheme.tertiary
    val hub = MaterialTheme.colorScheme.onSurfaceVariant
    val ground = MaterialTheme.colorScheme.surface

    Canvas(modifier) {
        if (nested) drawRings(count, current, line, place) else drawSpokes(count, current, line, place, hub, ground)
    }
}

private fun DrawScope.drawSpokes(
    count: Int,
    current: Int,
    line: Color,
    place: Color,
    hub: Color,
    ground: Color,
) {
    val node = size.minDimension * NODE_SHARE
    val stroke = 1.5.dp.toPx()
    val reach = size.minDimension / 2 - node * 2
    val points = hubPoints(count, layoutDirection).map { center + it * reach }

    points.forEach { drawLine(line, center, it, stroke) }
    drawCircle(hub, node * 0.9f, center)
    points.forEachIndexed { index, point ->
        if (index == current) {
            drawCircle(place.copy(alpha = HALO_ALPHA), node * 2, point)
            drawCircle(place, node * 1.1f, point)
        } else {
            drawCircle(ground, node, point)
            drawCircle(line, node, point, style = Stroke(stroke))
        }
    }
}

private fun DrawScope.drawRings(
    count: Int,
    current: Int,
    line: Color,
    place: Color,
) {
    val outer = size.minDimension / 2 - 2.dp.toPx()
    val inner = outer * INNER_RING_SHARE

    repeat(count) { index ->
        val radius = if (count == 1) outer else inner + (outer - inner) * index / (count - 1)
        val isPlace = index == current
        drawCircle(if (isPlace) place else line, radius, style = Stroke((if (isPlace) 2.5.dp else 1.25.dp).toPx()))
    }
}

/**
 * A teaching screen's words, marked as a teacher marks a board: the [marks]' main phrase
 * underlined, the bold term on a highlighter when [marksTerms], the example sentences in a dashed
 * box labeled "Example", and the screen's icon on the box's top corner, or on the words' when
 * there's no example. Without marks, it's the screen's title and text as they always were.
 */
@Composable
internal fun TeachingText(
    title: String?,
    text: String,
    marks: StepMarks?,
    marksTerms: Boolean,
) {
    val example = remember(text, marks?.example) { splitExample(text, marks?.example) }
    val underline = marks?.underline?.takeIf { it.isNotBlank() }
    val icon = marks?.icon
    val underlined = remember(example, text, underline) { underlinedPart(example?.parts ?: listOf(text), underline) }
    val body =
        @Composable { part: String, at: Int ->
            RichText(
                text = part,
                style = MaterialTheme.typography.bodyLarge,
                underline = underline.takeIf { at == underlined },
                marksTerms = marksTerms,
            )
        }
    val heading =
        @Composable { modifier: Modifier ->
            if (title != null) RichInlineText(title, modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        }

    if (example == null) {
        IconCorner(icon, title != null, heading) { body(text, 0) }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        heading(Modifier)
        if (example.before.isNotEmpty()) body(example.before, 0)
        ExampleBox(icon, Modifier.padding(vertical = 4.dp)) { body(example.example, 1) }
        if (example.after.isNotEmpty()) body(example.after, 2)
    }
}

/** The text before the example, the example's sentences and the text after them; null when the text doesn't show [example] word for word. */
internal data class ExampleSplit(
    val before: String,
    val example: String,
    val after: String,
) {
    val parts get() = listOf(before, example, after)
}

/** One underline at most: the index of the first part whose words, read without their marks, show the phrase. */
internal fun underlinedPart(
    parts: List<String>,
    underline: String?,
): Int? = underline?.let { phrase -> parts.indexOfFirst { plainText(it).contains(phrase) }.takeIf { it >= 0 } }

internal fun splitExample(
    text: String,
    example: String?,
): ExampleSplit? {
    val quote = example?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val at = text.indexOf(quote).takeIf { it >= 0 } ?: return null
    return ExampleSplit(text.substring(0, at).trim(), quote, text.substring(at + quote.length).trim())
}

/**
 * The icon on the top end corner of the screen's words: half above them, so it never covers what's
 * above, and beside the title, or beside every line when there's no title, so it never covers a word.
 */
@Composable
private fun IconCorner(
    icon: LessonIcon?,
    hasTitle: Boolean,
    heading: @Composable (Modifier) -> Unit,
    body: @Composable () -> Unit,
) {
    if (icon == null) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            heading(Modifier)
            body()
        }
        return
    }

    Box(Modifier.fillMaxWidth().padding(top = CORNER_ICON / 2)) {
        Column(
            Modifier.padding(end = if (hasTitle) 0.dp else ICON_ROOM),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            heading(Modifier.padding(end = ICON_ROOM).heightIn(min = CORNER_ICON / 2))
            body()
        }
        LessonIconImage(icon, CORNER_ICON, Modifier.align(Alignment.TopEnd).offset(x = ICON_OUTSET, y = -CORNER_ICON / 2))
    }
}

/**
 * Lousa's example frame: a dashed, slightly hand-drawn box with its label set into the top border,
 * as an outlined field's label is, and the screen's icon on its top end corner. TalkBack reads the
 * label before the sentences.
 */
@Composable
private fun ExampleBox(
    icon: LessonIcon?,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val label = stringResource(R.string.player_example)
    val labelStyle = MaterialTheme.typography.labelLarge
    val line = MaterialTheme.colorScheme.outline
    val measurer = rememberTextMeasurer()
    val labelHeight = with(LocalDensity.current) { labelStyle.lineHeight.toDp() }

    Box(modifier.fillMaxWidth().padding(top = if (icon == null) labelHeight / 2 else CORNER_ICON / 2)) {
        Text(
            label,
            Modifier.offset(x = LABEL_INSET, y = -labelHeight / 2),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = labelStyle,
        )
        Box(
            Modifier
                .fillMaxWidth()
                .drawWithCache {
                    val labelWidth = measurer.measure(label, labelStyle).size.width
                    val inset = LABEL_INSET.toPx()
                    val gap = LABEL_GAP.toPx()
                    val frame = exampleFrame(size, inset - gap, inset + labelWidth + gap, layoutDirection)
                    val stroke =
                        Stroke(FRAME_WIDTH.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(DASH.toPx(), DASH_GAP.toPx())))
                    onDrawBehind { rotate(FRAME_TILT) { drawPath(frame, line, style = stroke) } }
                }.padding(
                    start = BOX_PADDING,
                    end = BOX_PADDING + if (icon == null) 0.dp else ICON_ROOM - BOX_PADDING,
                    top = labelHeight / 2 + BOX_PADDING / 2,
                    bottom = BOX_PADDING,
                ),
        ) { content() }
        icon?.let { LessonIconImage(it, CORNER_ICON, Modifier.align(Alignment.TopEnd).offset(x = ICON_OUTSET, y = -CORNER_ICON / 2)) }
    }
}

/** A rounded frame whose corners differ a little, as a hand draws them, open along the top from [gapStart] to [gapEnd] for the label. */
private fun Density.exampleFrame(
    size: Size,
    gapStart: Float,
    gapEnd: Float,
    layoutDirection: LayoutDirection,
): Path {
    val (w, h) = size
    val topStart = Size(12.dp.toPx(), 8.dp.toPx())
    val topEnd = Size(8.dp.toPx(), 14.dp.toPx())
    val bottomEnd = Size(16.dp.toPx(), 7.dp.toPx())
    val bottomStart = Size(7.dp.toPx(), 15.dp.toPx())

    return Path().apply {
        moveTo(gapEnd, 0f)
        lineTo(w - topEnd.width, 0f)
        arcTo(Rect(w - topEnd.width * 2, 0f, w, topEnd.height * 2), -90f, 90f, false)
        lineTo(w, h - bottomEnd.height)
        arcTo(Rect(w - bottomEnd.width * 2, h - bottomEnd.height * 2, w, h), 0f, 90f, false)
        lineTo(bottomStart.width, h)
        arcTo(Rect(0f, h - bottomStart.height * 2, bottomStart.width * 2, h), 90f, 90f, false)
        lineTo(0f, topStart.height)
        arcTo(Rect(0f, 0f, topStart.width * 2, topStart.height * 2), 180f, 90f, false)
        lineTo(gapStart, 0f)
        if (layoutDirection == LayoutDirection.Rtl) {
            transform(
                Matrix().apply {
                    this[0, 0] = -1f
                    this[3, 0] = w
                },
            )
        }
    }
}

private const val SMALL_ICON_PIXELS = 96
private const val NODE_SHARE = 0.08f
private const val HALO_ALPHA = 0.25f
private const val INNER_RING_SHARE = 0.3f
private const val FRAME_TILT = -0.6f

private val STRIP_DRAWING = 40.dp
private val STRIP_ICON = 40.dp
private val CORNER_ICON = 56.dp
private val ICON_OUTSET = 8.dp
private val ICON_ROOM = 52.dp
private val BOX_PADDING = 16.dp
private val LABEL_INSET = 16.dp
private val LABEL_GAP = 4.dp
private val FRAME_WIDTH = 1.5.dp
private val DASH = 5.dp
private val DASH_GAP = 4.dp
