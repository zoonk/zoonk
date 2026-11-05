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
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.LessonMapIdeasInner
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Once tagged, a lesson's map can open it: its ideas say what they cover or have an icon. */
internal val LessonMap.opensLesson: Boolean
    get() = shape == LessonMap.Shape.HUB && ideas.size > 1 && ideas.any { it.about != null || it.icon != null }

/**
 * The opening scene's map (concept 3): the lesson's ideas, numbered, with their icons, around the
 * hub, where the strip's drawing later marks the learner's place. An idea with an `about` line opens
 * it in a popover, which says what the idea covers without giving its answer.
 */
@Composable
internal fun OpeningMap(
    map: LessonMap,
    modifier: Modifier = Modifier,
) {
    val ideas = map.ideas

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        IdeasAroundHub(ideas)
        Text(
            pluralStringResource(R.plurals.player_opening_map_ideas, ideas.size, count(ideas.size)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
    }
}

/** The ideas on an ellipse around the hub, with dashed spokes to it; TalkBack reads them in their order, wherever they sit. */
@Composable
private fun IdeasAroundHub(ideas: List<LessonMapIdeasInner>) {
    val line = MaterialTheme.colorScheme.outline
    val hub = MaterialTheme.colorScheme.onSurfaceVariant

    Layout(
        content = { ideas.forEachIndexed { index, idea -> HubIdea(index, idea, Modifier.semantics { traversalIndex = index.toFloat() }) } },
        modifier =
            Modifier
                .widthIn(max = HUB_WIDTH)
                .fillMaxWidth()
                .semantics { isTraversalGroup = true }
                .drawBehind {
                    val node = HUB_NODE.toPx()
                    val dash = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))
                    hubPoints(ideas.size, layoutDirection).forEach { point ->
                        val end = Offset(center.x + point.x * (size.width - node) / 2, center.y + point.y * (size.height - node) / 2)
                        drawLine(line, center, end, 1.5.dp.toPx(), pathEffect = dash)
                    }
                    drawCircle(hub, HUB_DOT.toPx())
                },
    ) { measurables, constraints ->
        val nodes = measurables.map { it.measure(Constraints()) }
        val node = HUB_NODE.roundToPx()
        val width = constraints.maxWidth
        val height = (width * HUB_ASPECT).roundToInt().coerceAtLeast(node * 3)
        val points = hubPoints(nodes.size, layoutDirection)

        layout(width, height) {
            nodes.forEachIndexed { index, placeable ->
                val x = width / 2f + points[index].x * (width - node) / 2
                val y = height / 2f + points[index].y * (height - node) / 2
                placeable.place((x - placeable.width / 2f).roundToInt(), (y - placeable.height / 2f).roundToInt())
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HubIdea(
    index: Int,
    idea: LessonMapIdeasInner,
    modifier: Modifier,
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

    val place =
        @Composable { placeModifier: Modifier ->
            Box(
                placeModifier
                    .size(HUB_NODE)
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
                    LessonIconImage(icon, HUB_ICON)
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
        place(modifier.semantics(mergeDescendants = true) { contentDescription = name })
        return
    }

    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { RichTooltip { Text(about) } },
        state = tooltip,
        modifier = modifier,
    ) {
        place(
            Modifier
                .clickable(onClickLabel = showLabel, role = Role.Button) { scope.launch { tooltip.show() } }
                .semantics(mergeDescendants = true) { contentDescription = name },
        )
    }
}

private const val HUB_ASPECT = 0.62f

private val HUB_WIDTH = 320.dp
private val HUB_NODE = 56.dp
private val HUB_ICON = 44.dp
private val HUB_DOT = 5.dp
private val BADGE = 20.dp
private val BADGE_OUTSET = 4.dp
