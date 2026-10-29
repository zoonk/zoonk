package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.AlignmentLine
import androidx.compose.ui.layout.FirstBaseline
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.withTabularFigures
import kotlin.math.max

/** A question's options, read by TalkBack as one group of choices. */
@Composable
fun AnswerOptionGroup(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier.fillMaxWidth().selectableGroup(), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
}

/**
 * One option of a question (main's `AnswerOption`): its number key (for keyboards, so TalkBack
 * skips it), its words and, once checked,
 * the word its result shows. The word sits beside the option's words while their longest word fits
 * next to it, and under them otherwise, so a long word never breaks at a large font. An option
 * among several picks is a [Role.Checkbox]; [tag] replaces the result's word (an order step's place).
 */
@Composable
fun AnswerOption(
    marker: Int,
    picked: Boolean,
    result: AnswerResult?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    role: Role = Role.RadioButton,
    tag: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(12.dp)

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .then(
                    if (role == Role.Checkbox) {
                        Modifier.toggleable(value = picked, enabled = enabled, role = role, onValueChange = { onClick() })
                    } else {
                        Modifier.selectable(selected = picked, enabled = enabled, role = role, onClick = onClick)
                    },
                ).padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        NumberKey(marker, Modifier.alignByBaseline())
        TagBesideOrUnder(
            modifier = Modifier.weight(1f).alignByBaseline(),
            content = content,
            tag = tag ?: { if (result != null) AnswerTag(picked, result) },
        )
    }
}

@Composable
private fun NumberKey(
    number: Int,
    modifier: Modifier,
) {
    Box(
        modifier =
            modifier
                .clearAndSetSemantics {}
                .defaultMinSize(minWidth = 22.dp, minHeight = 22.dp)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(6.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = number.toString(),
            modifier = Modifier.padding(horizontal = 6.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}

@Composable
private fun TagBesideOrUnder(
    modifier: Modifier,
    content: @Composable () -> Unit,
    tag: @Composable () -> Unit,
) {
    Layout(contents = listOf(content, tag), modifier = modifier) { (words, tags), constraints ->
        val gap = 12.dp.roundToPx()
        val width = constraints.maxWidth
        val tagPlaceable = tags.firstOrNull()?.measure(constraints.copy(minWidth = 0, minHeight = 0))
        val tagWidth = tagPlaceable?.width ?: 0
        val tagHeight = tagPlaceable?.height ?: 0
        val longestWord = words.firstOrNull()?.minIntrinsicWidth(constraints.maxHeight) ?: 0
        val beside = tagPlaceable == null || longestWord + gap + tagWidth <= width
        val wordsWidth = if (beside && tagPlaceable != null) width - gap - tagWidth else width
        val wordsPlaceable = words.firstOrNull()?.measure(constraints.copy(minWidth = 0, maxWidth = max(0, wordsWidth)))
        val wordsHeight = wordsPlaceable?.height ?: 0
        val height = if (beside) max(wordsHeight, tagHeight) else wordsHeight + gap / 2 + tagHeight

        layout(width, max(height, constraints.minHeight)) {
            wordsPlaceable?.placeRelative(0, 0)
            if (beside) {
                val wordsBaseline = wordsPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
                val tagBaseline = tagPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
                tagPlaceable?.placeRelative(width - tagWidth, max(0, wordsBaseline - tagBaseline))
            } else {
                tagPlaceable.placeRelative(0, wordsHeight + gap / 2)
            }
        }
    }
}
