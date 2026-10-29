package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivitySortableList
import com.zoonk.android.feature.activities.RestoreActivityAnswer
import com.zoonk.android.feature.activities.SortableItem
import com.zoonk.android.feature.activities.orderAnswer
import com.zoonk.android.feature.activities.orderIds
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf12FieldsStepsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf12Value as ProcessOrderContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf12FieldsStepsInner.Icon as ProcessIconName

private typealias ProcessStep = PlayableLibraryStepAnyOfContentOneOf12FieldsStepsInner

val processOrderRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_put_in_order, R.drawable.ic_swap_vert) },
        canvas = { ProcessOrderActivity(it) },
    )

@Composable
private fun ProcessOrderActivity(props: ActivityProps) {
    val content = (props.content as ProcessOrderContent).value
    val steps = content.fields.steps
    val shuffled = remember(content) { shuffleSteps(steps, "${content.prompt}:${steps.joinToString(",") { it.id }}") }
    var order by rememberSaveable { mutableStateOf(props.answer.orderIds ?: shuffled.map { it.id }) }
    var moved by rememberSaveable { mutableStateOf(props.answer != null) }
    RestoreActivityAnswer(props) { orderAnswer(order).takeIf { moved } }
    val byId = steps.associateBy { it.id }

    if (props.isChecked) {
        val results = stepResults(steps.map { it.id }, order)
        ActivityCanvas(gap = 8.dp) {
            ActivityCanvasLabel(stringResource(R.string.activities_sorting_right_order))
            steps.forEachIndexed { index, step -> OrderedStep(step, results[index], index) }
        }
        return
    }

    ActivityCanvas(gap = 8.dp) {
        ActivitySortableList(
            items = order.mapNotNull { id -> byId[id]?.let { SortableItem(id, it.text) } },
            label = stringResource(R.string.activities_sorting_steps_in_your_order),
            onReorder = { ids ->
                order = ids
                moved = true
                props.onAnswerChange(orderAnswer(ids))
            },
            enabled = !props.isLocked,
        ) { item, index ->
            StepMarks(byId[item.id]?.icon, index + 1, result = null)
            RichText(
                item.label,
                Modifier.weight(1f).padding(top = TEXT_TOP),
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            )
        }
        ActivityCanvasLabel(stringResource(R.string.activities_sorting_drag_steps))
    }
}

@Composable
private fun OrderedStep(
    step: ProcessStep,
    result: StepResult,
    index: Int,
) {
    val outcome = if (result.learnerPosition == result.position) AnswerResult.Right else AnswerResult.Wrong
    val tone = answerTone(picked = false, result = outcome)
    val shape = RoundedCornerShape(12.dp)

    Row(
        Modifier
            .fillMaxWidth()
            .background(tone.container, shape)
            .border(tone.border, shape)
            .semantics(mergeDescendants = true) { collectionItemInfo = CollectionItemInfo(index, 1, 0, 1) }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StepMarks(step.icon, result.position, outcome)
        Column(Modifier.weight(1f).padding(top = TEXT_TOP), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RichText(step.text, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
            step.why?.let {
                RichText(it, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
            }
            val had = result.learnerPosition
            if (outcome == AnswerResult.Wrong && had != null) {
                Text(
                    stringResource(R.string.activities_sorting_you_had_it_at, had),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                )
            }
        }
    }
}

/** A step's place and its process icon, one line of the step's text tall. */
@Composable
private fun StepMarks(
    icon: ProcessIconName?,
    position: Int,
    result: AnswerResult?,
) {
    val colors = MaterialTheme.colorScheme
    val (fill, ink) =
        when (result) {
            AnswerResult.Right -> colors.tertiary to colors.onTertiary
            AnswerResult.Wrong -> colors.error to colors.onError
            else -> colors.surfaceContainerHighest to colors.onSurface
        }

    val line =
        with(LocalDensity.current) {
            MaterialTheme.typography.bodyMedium.lineHeight
                .toDp()
        }
    Row(
        Modifier.height(max(MARKS, line + TEXT_TOP * 2)).clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.defaultMinSize(BADGE, BADGE).background(fill, CircleShape).padding(2.dp), contentAlignment = Alignment.Center) {
            Text(
                "$position",
                color = ink,
                style =
                    MaterialTheme.typography.labelMedium
                        .withTabularFigures()
                        .copy(fontWeight = FontWeight.SemiBold),
            )
        }
        icon?.let {
            Icon(
                painterResource(processIcon(it)),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = colors.onSurfaceVariant,
            )
        }
    }
}

private val MARKS = 32.dp
private val BADGE = 28.dp

/** The step text sits this far below the top of its marks, so both share one first line. */
private val TEXT_TOP = 6.dp
