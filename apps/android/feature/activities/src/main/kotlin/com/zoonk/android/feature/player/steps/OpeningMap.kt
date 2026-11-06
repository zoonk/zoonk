package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.PopupPositionProvider
import com.zoonk.android.R
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.LessonMapIdeasInner
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Once tagged, a lesson's map can open it: its ideas say what they cover or have an icon. */
internal val LessonMap.opensLesson: Boolean
    get() = ideas.any { it.about != null || it.icon != null }

/**
 * The opening scene's map (concept 3): the lesson's ideas, numbered, with their icons, around a
 * plain dot, where the strip's drawing later marks the learner's place. An idea with an `about` line
 * opens it in a popover, which says what the idea covers without giving its answer.
 */
@Composable
internal fun OpeningMap(
    map: LessonMap,
    modifier: Modifier = Modifier,
) {
    val ideas = map.ideas

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        IdeasAroundCenter(ideas)
        Text(
            pluralStringResource(R.plurals.player_opening_map_ideas, ideas.size, count(ideas.size)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
    }
}

/** The ideas in their slots, each joined to the center by a dashed line. The slots hold the ideas in reading order, so TalkBack reads them by number. */
@Composable
private fun IdeasAroundCenter(ideas: List<LessonMapIdeasInner>) {
    val line = MaterialTheme.colorScheme.outline
    val dot = MaterialTheme.colorScheme.onSurfaceVariant
    val slots = remember(ideas.size) { ideaSlots(ideas.size) }
    val rows = slotRows(slots)

    Layout(
        content = { ideas.forEachIndexed { index, idea -> OpeningIdea(index, idea) } },
        modifier =
            Modifier
                .widthIn(max = OPENING_MAP_WIDTH)
                .fillMaxWidth()
                .drawBehind {
                    val center = slotCenter(IdeaSlot(0, 0), rows, size.width)
                    val dash = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))
                    // The slots pair up across the middle, so the lines need no mirroring for right-to-left.
                    slots.forEach { drawLine(line, center, slotCenter(it, rows, size.width), 1.5.dp.toPx(), pathEffect = dash) }
                    drawCircle(dot, CENTER_DOT.toPx(), center)
                },
    ) { measurables, constraints ->
        val nodes = measurables.map { it.measure(Constraints()) }
        val width = constraints.maxWidth
        val height = OPENING_NODE.roundToPx() + OPENING_ROW_GAP.roundToPx() * (rows.last - rows.first)

        layout(width, height) {
            nodes.forEachIndexed { index, placeable ->
                val at = slotCenter(slots[index], rows, width.toFloat())
                placeable.placeRelative((at.x - placeable.width / 2f).roundToInt(), (at.y - placeable.height / 2f).roundToInt())
            }
        }
    }
}

/** A slot's middle in a map [width] wide: the side columns touch its edges and the rows keep main's spacing. */
private fun Density.slotCenter(
    slot: IdeaSlot,
    rows: IntRange,
    width: Float,
): Offset {
    val node = OPENING_NODE.toPx()
    return Offset(width / 2 + slot.column * (width - node) / 2, node / 2 + (slot.row - rows.first) * OPENING_ROW_GAP.toPx())
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OpeningIdea(
    index: Int,
    idea: LessonMapIdeasInner,
) {
    val number = count(index + 1)
    // Before the lesson, an idea is its number: its name is often the term the lesson teaches.
    val name = stringResource(R.string.player_opening_map_idea, number)
    val about = idea.about
    val tooltip = rememberTooltipState(isPersistent = true)
    val scope = rememberCoroutineScope()
    val ground = MaterialTheme.colorScheme.surface
    val line = MaterialTheme.colorScheme.outline
    val showLabel = stringResource(R.string.player_opening_map_show)
    val below = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Below)

    val place =
        @Composable { placeModifier: Modifier ->
            Box(
                placeModifier
                    .size(OPENING_NODE)
                    .drawBehind {
                        drawCircle(ground)
                        if (idea.icon == null) {
                            drawCircle(
                                line,
                                style =
                                    Stroke(
                                        1.5.dp.toPx(),
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
                                    ),
                            )
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                val icon = idea.icon
                if (icon == null) {
                    Text(number, style = MaterialTheme.typography.titleMedium.withTabularFigures())
                } else {
                    LessonIconImage(icon, OPENING_ICON)
                    Text(
                        number,
                        Modifier
                            .align(Alignment.TopStart)
                            .offset(x = -BADGE_OUTSET, y = -BADGE_OUTSET)
                            .defaultMinSize(BADGE, BADGE)
                            .background(MaterialTheme.colorScheme.surfaceContainerHighest, CircleShape)
                            .padding(horizontal = 4.dp),
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }

    if (about == null) {
        place(Modifier.semantics(mergeDescendants = true) { contentDescription = name })
        return
    }

    TooltipBox(
        positionProvider = remember(below) { BelowIdea(below) },
        tooltip = { RichTooltip { Text(about) } },
        state = tooltip,
    ) {
        place(
            Modifier
                .clickable(onClickLabel = showLabel, role = Role.Button) { scope.launch { tooltip.show() } }
                .semantics(mergeDescendants = true) { contentDescription = name },
        )
    }
}

/**
 * An idea's popover goes under it, away from the scene's words right above the map. Material's
 * placement below an anchor flips above it when the window has no room left, onto those words, so
 * there the popover sits on the window's bottom edge instead.
 */
private class BelowIdea(
    private val below: PopupPositionProvider,
) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val placed = below.calculatePosition(anchorBounds, windowSize, layoutDirection, popupContentSize)
        return if (placed.y >= anchorBounds.bottom) placed else placed.copy(y = maxOf(0, windowSize.height - popupContentSize.height))
    }
}

private val OPENING_MAP_WIDTH = 240.dp
private val OPENING_NODE = 56.dp
private val OPENING_ROW_GAP = 80.dp
private val OPENING_ICON = 44.dp
private val CENTER_DOT = 5.dp
private val BADGE = 20.dp
private val BADGE_OUTSET = 4.dp
