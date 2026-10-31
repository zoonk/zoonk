package com.zoonk.android.feature.questions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.theme.withTabularFigures

/** A checked order: the learner's and, when the server says it, the right one. */
data class OrderCheck(
    val order: List<Int>,
    val correctOrder: List<Int>,
)

/**
 * Steps tapped in order (main's `OrderQuestion`): each placed step shows its place, and tapping it
 * takes it out. The host gets the order once every step has a place, null before.
 */
@Composable
fun OrderQuestion(
    steps: List<String>,
    check: OrderCheck?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var order by rememberSaveable { mutableStateOf(emptyList<Int>()) }
    val locked = !enabled || check != null
    val placed = check?.order ?: order

    fun tap(index: Int) {
        order = if (index in order) order - index else order + index
        onAnswer(if (order.size == steps.size) Answer.Order(order) else null)
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = stringResource(R.string.questions_order_hint),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )

        AnswerOptionGroup {
            steps.forEachIndexed { index, step ->
                val place = placed.indexOf(index)
                val result =
                    check?.let {
                        if (it.order.indexOf(index) ==
                            it.correctOrder.indexOf(index)
                        ) {
                            AnswerResult.Right
                        } else {
                            AnswerResult.Wrong
                        }
                    }

                AnswerOption(
                    marker = index + 1,
                    picked = place != -1,
                    result = result,
                    onClick = { tap(index) },
                    enabled = !locked,
                    role = Role.Checkbox,
                    tag = { if (place != -1) PlaceTag(place, result) },
                ) { ItemLine(step, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}

@Composable
private fun PlaceTag(
    place: Int,
    result: AnswerResult?,
) {
    val description =
        when (result) {
            AnswerResult.Right -> stringResource(R.string.questions_place_right, place + 1)
            AnswerResult.Wrong -> stringResource(R.string.questions_place_wrong, place + 1)
            else -> stringResource(R.string.questions_place, place + 1)
        }

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
