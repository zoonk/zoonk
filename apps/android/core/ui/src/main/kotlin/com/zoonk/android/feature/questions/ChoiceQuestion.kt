package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult

/** A checked choice: the right options (none in a duel until it ends) and the learner's picks. */
data class ChoiceCheck(
    val correct: List<Int>,
    val picked: List<Int>,
)

/**
 * One pick or several (main's block `ChoiceQuestion`). The host gets the answer once it's
 * complete, null before; key it by the question so its picks start empty. Once checked, only the
 * right options and the learner's stay.
 */
@Composable
fun ChoiceQuestion(
    options: List<String>,
    select: Select?,
    check: ChoiceCheck?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var picks by rememberSaveable { mutableStateOf(emptyList<Int>()) }
    val multi = select.isMulti
    val locked = !enabled || check != null
    val shown = check?.picked ?: picks

    fun pick(index: Int) {
        if (select != null && multi) {
            picks = if (index in picks) picks - index else picks + index
            onAnswer(if (select.isComplete(picks)) Answer.Choices(picks) else null)
            return
        }

        val cleared = picks.firstOrNull() == index
        picks = if (cleared) emptyList() else listOf(index)
        onAnswer(if (cleared) null else Answer.Choice(index))
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (select != null && multi) PickRule(select)

        AnswerOptionGroup {
            options.forEachIndexed { index, option ->
                if (!isShown(index, check)) return@forEachIndexed

                AnswerOption(
                    marker = index + 1,
                    picked = index in shown,
                    result = optionResult(index, check),
                    onClick = { pick(index) },
                    enabled = !locked,
                    role = if (multi) Role.Checkbox else Role.RadioButton,
                ) { ItemLine(option, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}

/** "Choose 2 options." or "Select all that apply." above a question with several picks. */
@Composable
fun PickRule(
    select: Select,
    modifier: Modifier = Modifier,
) {
    val text =
        when (select) {
            Select.All -> stringResource(R.string.questions_pick_all)
            is Select.Count -> pluralStringResource(R.plurals.questions_pick_count, select.count, select.count)
        }

    Text(
        text = text,
        modifier = modifier,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
        fontWeight = FontWeight.Medium,
    )
}

private fun optionResult(
    index: Int,
    check: ChoiceCheck?,
): AnswerResult? =
    when {
        check == null -> null
        index in check.correct -> AnswerResult.Right
        index in check.picked -> AnswerResult.Wrong
        else -> null
    }

private fun isShown(
    index: Int,
    check: ChoiceCheck?,
): Boolean = check == null || check.correct.isEmpty() || index in check.correct || index in check.picked
