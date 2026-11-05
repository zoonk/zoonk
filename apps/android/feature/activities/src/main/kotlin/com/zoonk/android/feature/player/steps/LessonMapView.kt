package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.LessonMapIdeasInner

@Composable
internal fun LessonMapStepView(content: StepContent.Map) {
    ReadScene {
        LabelChip(
            stringResource(R.string.player_lesson_map),
            Modifier.semantics(mergeDescendants = true) { heading() },
            icon = R.drawable.ic_lan,
        )
        LessonMapView(content.map, content.title)
    }
}

/**
 * The lesson's ideas, always all in view, with nothing to tap: the end screen, the ⋮ sheet and the
 * end of a spread draw it alike. A hub is a mind map around the lesson's title (concept 3's end
 * screen) where two ideas fit side by side at the text's size, and a tree under the title where they
 * don't.
 */
@Composable
fun LessonMapView(
    map: LessonMap,
    title: String,
    modifier: Modifier = Modifier,
) {
    when (map.shape) {
        LessonMap.Shape.HUB -> {
            BoxWithConstraints(modifier.fillMaxWidth()) {
                val fontScale = LocalDensity.current.fontScale
                if (map.ideas.size > 1 && (maxWidth - MIND_MAP_GAP) / 2 >= MIND_MAP_CARD * fontScale) {
                    MindMap(title, map.ideas)
                } else {
                    HubMap(title, map.ideas, Modifier)
                }
            }
        }

        LessonMap.Shape.NESTED -> {
            NestedMap(map.ideas, modifier)
        }
    }
}

/**
 * The lesson's title in the middle, its first ideas above it and the rest below, two to a row, each
 * joined to the title by a branch. TalkBack reads the title, then the ideas in order.
 */
@Composable
private fun MindMap(
    title: String,
    ideas: List<LessonMapIdeasInner>,
) {
    val line = MaterialTheme.colorScheme.outline
    var branches by remember { mutableStateOf(emptyList<Pair<Offset, Offset>>()) }

    Layout(
        content = {
            Text(
                title,
                Modifier
                    .semantics { traversalIndex = -1f }
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.small)
                    .padding(12.dp, 6.dp),
                style = MaterialTheme.typography.titleSmall,
                textAlign = TextAlign.Center,
            )
            ideas.forEachIndexed { index, idea ->
                MindMapIdea(
                    index,
                    idea,
                    Modifier.semantics {
                        traversalIndex = index.toFloat()
                        collectionItemInfo = CollectionItemInfo(rowIndex = index, rowSpan = 1, columnIndex = 0, columnSpan = 1)
                    },
                )
            }
        },
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics {
                    isTraversalGroup = true
                    collectionInfo = CollectionInfo(rowCount = ideas.size, columnCount = 1)
                }.drawBehind {
                    val stroke = 1.5.dp.toPx()
                    branches.forEach { (from, to) ->
                        val path =
                            Path().apply {
                                moveTo(from.x, from.y)
                                cubicTo(from.x, (from.y + to.y) / 2, to.x, (from.y + to.y) / 2, to.x, to.y)
                            }
                        drawPath(path, line, style = Stroke(stroke))
                    }
                },
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val gap = MIND_MAP_GAP.roundToPx()
        val rowGap = MIND_MAP_ROW_GAP.roundToPx()
        val cardWidth = (width - gap) / 2
        val pill = measurables.first().measure(Constraints(maxWidth = (width * PILL_SHARE).toInt()))
        val cards = measurables.drop(1).map { it.measure(Constraints.fixedWidth(cardWidth)) }
        // Whole rows above the title, so a lone card comes last and its branch runs between the two cards before it.
        val above = ((cards.size + 1) / 2).let { if (it > 1) it - it % 2 else it }
        // Rows of two, the title between the first rows and the rest; a lone card sits in the middle of its row.
        val topRows = cards.take(above).chunked(2)
        val bottomRows = cards.drop(above).chunked(2)
        val rowHeight = { row: List<Placeable> -> row.maxOf { it.height } }
        val topHeight = topRows.sumOf(rowHeight) + rowGap * (topRows.size - 1).coerceAtLeast(0)
        val bottomHeight = bottomRows.sumOf(rowHeight) + rowGap * (bottomRows.size - 1).coerceAtLeast(0)
        val pillGap = PILL_GAP.roundToPx()
        val pillTop = topHeight + pillGap
        val bottomTop = pillTop + pill.height + pillGap
        val height = bottomTop + bottomHeight
        val placed = mutableListOf<Pair<Placeable, Offset>>()

        fun placeRows(
            rowsToPlace: List<List<Placeable>>,
            top: Int,
        ) {
            var y = top
            rowsToPlace.forEach { row ->
                row.forEachIndexed { at, card ->
                    val x = if (row.size == 1) (width - cardWidth) / 2 else at * (cardWidth + gap)
                    placed += card to Offset(x.toFloat(), y.toFloat())
                }
                y += rowHeight(row) + rowGap
            }
        }
        placeRows(topRows, 0)
        placeRows(bottomRows, bottomTop)

        val pillX = (width - pill.width) / 2
        val hub = Offset(width / 2f, pillTop + pill.height / 2f)
        branches =
            placed.map { (card, at) ->
                val isAbove = at.y < pillTop
                hub to Offset(at.x + card.width / 2f, if (isAbove) at.y + card.height else at.y)
            }

        layout(width, height) {
            pill.placeRelative(pillX, pillTop)
            placed.forEach { (card, at) -> card.place(at.x.toInt(), at.y.toInt()) }
        }
    }
}

@Composable
private fun MindMapIdea(
    index: Int,
    idea: LessonMapIdeasInner,
    modifier: Modifier,
) {
    Column(
        modifier
            .semantics(mergeDescendants = true) {}
            .background(MaterialTheme.colorScheme.surface, MaterialTheme.shapes.medium)
            .border(HAIRLINE, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.medium)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            idea.icon?.let { LessonIconImage(it, CARD_ICON) }
            Column {
                Text(
                    count(index + 1),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
                idea.label?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
            }
        }
        RichInlineText(
            idea.text,
            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
        )
    }
}

@Composable
private fun HubMap(
    title: String,
    ideas: List<LessonMapIdeasInner>,
    modifier: Modifier,
) {
    val line = MaterialTheme.colorScheme.outline
    val labelLine = MaterialTheme.typography.titleSmall.lineHeight
    val sentenceLine = MaterialTheme.typography.bodyLarge.lineHeight

    Column(modifier.fillMaxWidth()) {
        Text(
            title,
            Modifier.background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.small).padding(12.dp, 6.dp),
            style = MaterialTheme.typography.titleSmall,
        )
        Column(Modifier.semantics { collectionInfo = CollectionInfo(rowCount = ideas.size, columnCount = 1) }) {
            ideas.forEachIndexed { index, idea ->
                val firstLine = with(LocalDensity.current) { (if (idea.label == null) sentenceLine else labelLine).toPx() }

                MapIdea(
                    idea,
                    Modifier
                        .semantics {
                            collectionItemInfo = CollectionItemInfo(rowIndex = index, rowSpan = 1, columnIndex = 0, columnSpan = 1)
                        }.drawBehind {
                            val isRtl = layoutDirection == LayoutDirection.Rtl
                            val spine = if (isRtl) size.width - SPINE_INSET.toPx() else SPINE_INSET.toPx()
                            val tickEnd = spine + if (isRtl) -TICK.toPx() else TICK.toPx()
                            val tick = BRANCH_GAP.toPx() + firstLine / 2
                            val bottom = if (index == ideas.lastIndex) tick else size.height
                            val stroke = HAIRLINE.toPx()

                            drawLine(line, Offset(spine, 0f), Offset(spine, bottom), stroke)
                            drawLine(line, Offset(spine, tick), Offset(tickEnd, tick), stroke)
                        }.padding(start = BRANCH_INDENT, top = BRANCH_GAP),
                )
            }
        }
    }
}

/** The smallest level first, each one's box inside the next, so the reading order is the teaching order. */
@Composable
private fun NestedMap(
    ideas: List<LessonMapIdeasInner>,
    modifier: Modifier,
) {
    NestedLevel(ideas, ideas.lastIndex, depth = 0, stringResource(R.string.player_lesson_map_nested), modifier)
}

@Composable
private fun NestedLevel(
    ideas: List<LessonMapIdeasInner>,
    index: Int,
    depth: Int,
    nesting: String,
    modifier: Modifier = Modifier,
) {
    val shape = with(MaterialTheme.shapes) { listOf(large, medium, small).getOrElse(depth) { extraSmall } }

    if (index == 0) {
        MapIdea(
            ideas.first(),
            modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceContainerHigh, shape).padding(12.dp),
            readFirst = nesting,
        )
        return
    }

    Column(
        modifier.fillMaxWidth().border(HAIRLINE, MaterialTheme.colorScheme.outline, shape).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        NestedLevel(ideas, index - 1, depth + 1, nesting)
        MapIdea(ideas[index])
    }
}

/** A stored idea has no label, so its sentence is the node's main text. [readFirst] is heard before it, never seen. */
@Composable
private fun MapIdea(
    idea: LessonMapIdeasInner,
    modifier: Modifier = Modifier,
    readFirst: String? = null,
) {
    Row(
        modifier.semantics(mergeDescendants = true) { readFirst?.let { text = AnnotatedString(it) } },
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        idea.icon?.let { LessonIconImage(it, CARD_ICON) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            idea.label?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
            RichInlineText(
                idea.text,
                style =
                    if (idea.label == null) {
                        MaterialTheme.typography.bodyLarge
                    } else {
                        MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                    },
            )
        }
    }
}

private const val PILL_SHARE = 0.7f

private val HAIRLINE = 1.dp
private val MIND_MAP_CARD = 150.dp
private val MIND_MAP_GAP = 12.dp
private val MIND_MAP_ROW_GAP = 12.dp
private val PILL_GAP = 20.dp
private val CARD_ICON = 32.dp
private val SPINE_INSET = 12.dp
private val BRANCH_INDENT = 28.dp
private val BRANCH_GAP = 14.dp
private val TICK = 10.dp
