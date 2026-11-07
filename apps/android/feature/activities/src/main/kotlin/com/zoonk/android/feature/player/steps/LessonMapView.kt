package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
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
        LessonMapView(content)
    }
}

/**
 * The lesson's ideas as a mind map around its title (concept 3's end screen), always all in view,
 * with nothing to tap: the end screen, the ⋮ sheet and the end of a spread draw it alike. A nested
 * map adds that each level sits inside the next.
 */
@Composable
fun LessonMapView(
    content: StepContent.Map,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        MindMap(content.title, content.map.ideas)
        if (content.map.shape == LessonMap.Shape.NESTED) {
            Text(
                stringResource(R.string.player_lesson_map_nested),
                Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * The lesson's title in the middle and its ideas in the opening map's places, each joined to the
 * title by a branch, where two cards fit side by side at the text's size (main's 22rem); one column
 * under the title where they don't. TalkBack reads the title, then the ideas in order.
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
        val twoColumns = width >= (TWO_COLUMNS * fontScale).roundToPx()
        val gap = MIND_MAP_GAP.roundToPx()
        val cardWidth = if (twoColumns) (width - gap) / 2 else width
        val slots = if (twoColumns) ideaSlots(ideas.size) else List(ideas.size) { IdeaSlot(0, it + 1) }
        val rows = slotRows(slots)
        val pill = measurables.first().measure(Constraints(maxWidth = (width * PILL_SHARE).toInt()))
        val cards = measurables.drop(1).map { it.measure(Constraints.fixedWidth(cardWidth)) }
        val tops = mutableMapOf<Int, Int>()
        val height =
            rows.fold(0) { top, row ->
                val spacing =
                    if (row == rows.first) {
                        0
                    } else if (row == 0 || row == 1) {
                        PILL_GAP.roundToPx()
                    } else {
                        MIND_MAP_ROW_GAP.roundToPx()
                    }
                tops[row] = top + spacing
                top + spacing +
                    if (row == 0) pill.height else cards.filterIndexed { index, _ -> slots[index].row == row }.maxOf { it.height }
            }
        val cardX = { slot: IdeaSlot -> (width - cardWidth) / 2 * (slot.column + 1) }
        val hub = Offset(width / 2f, tops.getValue(0) + pill.height / 2f)
        val mirror = layoutDirection == LayoutDirection.Rtl

        branches =
            cards.mapIndexed { index, card ->
                val slot = slots[index]
                val middle = cardX(slot) + card.width / 2f
                val top = tops.getValue(slot.row)
                hub to Offset(if (mirror) width - middle else middle, (if (slot.row < 0) top + card.height else top).toFloat())
            }

        layout(width, height) {
            pill.placeRelative((width - pill.width) / 2, tops.getValue(0))
            cards.forEachIndexed { index, card -> card.placeRelative(cardX(slots[index]), tops.getValue(slots[index].row)) }
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
            .background(MaterialTheme.colorScheme.surfaceContainerLow, MaterialTheme.shapes.large)
            .border(HAIRLINE, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.large)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            idea.icon?.let { LessonIconImage(it, CARD_ICON) }
            Column {
                Text(count(index + 1), color = MaterialTheme.zoonk.faint, style = MaterialTheme.zoonkType.data)
                idea.label?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
            }
        }
        RichInlineText(
            idea.text,
            // Main's idea text is quiet under its name and ink when it stands alone.
            style =
                MaterialTheme.typography.bodyMedium.copy(
                    color = if (idea.label == null) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                ),
        )
    }
}

private const val PILL_SHARE = 0.7f

private val HAIRLINE = 1.dp
private val TWO_COLUMNS = 352.dp
private val MIND_MAP_GAP = 12.dp
private val MIND_MAP_ROW_GAP = 12.dp
private val PILL_GAP = 20.dp
private val CARD_ICON = 32.dp
