package com.zoonk.android.feature.questions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivitySortableList
import com.zoonk.android.feature.activities.SortableItem
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.theme.withTabularFigures

@Composable
internal fun OrderQuestion(
    steps: List<String>,
    order: List<Int>,
    check: List<Int>?,
    enabled: Boolean,
    onAnswer: (Answer.Order) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (check != null) {
        AnswerOptionGroup(modifier) {
            order.forEachIndexed { place, index ->
                val result = if (check.getOrNull(place) == index) AnswerResult.Right else AnswerResult.Wrong
                AnswerOption(
                    marker = place + 1,
                    picked = true,
                    result = result,
                    onClick = {},
                    enabled = false,
                    role = null,
                    tag = { PlaceTag(place, result) },
                ) { ItemLine(steps.getOrNull(index).orEmpty()) }
            }
        }
        return
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (enabled) {
            Text(
                text = stringResource(R.string.activities_sorting_drag_steps),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
        }
        ActivitySortableList(
            items = order.map { SortableItem(it.toString(), steps.getOrNull(it).orEmpty()) },
            label = stringResource(R.string.activities_sorting_steps_in_your_order),
            onReorder = { ids -> onAnswer(Answer.Order(ids.map(String::toInt))) },
            enabled = enabled,
        ) { item, _ ->
            ItemLine(
                item.label,
                Modifier.weight(1f).padding(vertical = 6.dp),
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            )
        }
    }
}

@Composable
private fun PlaceTag(
    place: Int,
    result: AnswerResult,
) {
    val description =
        stringResource(if (result == AnswerResult.Right) R.string.questions_place_right else R.string.questions_place_wrong, place + 1)

    Box(
        Modifier
            .clearAndSetSemantics { contentDescription = description }
            .defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
            .background(MaterialTheme.colorScheme.onSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = (place + 1).toString(),
            color = MaterialTheme.colorScheme.surface,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}
