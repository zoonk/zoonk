package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.richtext.RichInlineText
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

/** The lesson's ideas, always all in view, with nothing to tap: the end screen, the ⋮ sheet and the end of a spread draw it alike. */
@Composable
fun LessonMapView(
    map: LessonMap,
    title: String,
    modifier: Modifier = Modifier,
) {
    when (map.shape) {
        LessonMap.Shape.HUB -> HubMap(title, map.ideas, modifier)
        LessonMap.Shape.NESTED -> NestedMap(map.ideas, modifier)
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
    Column(
        modifier.semantics(mergeDescendants = true) { readFirst?.let { text = AnnotatedString(it) } },
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
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

private val HAIRLINE = 1.dp
private val SPINE_INSET = 12.dp
private val BRANCH_INDENT = 28.dp
private val BRANCH_GAP = 14.dp
private val TICK = 10.dp
