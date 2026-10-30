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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.Painter
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
 * skips it), its words and, once checked, the word its result shows. An option among several
 * picks is a [Role.Checkbox]; [tag] replaces the result's word (an order step's place). A [glyph]
 * marks the key in place of its number, as main's net-scored statements (✓, ✗, –).
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
    glyph: Painter? = null,
    content: @Composable () -> Unit,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(12.dp)

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .then(
                    if (role == Role.Checkbox) {
                        Modifier.toggleable(value = picked, enabled = enabled, role = role, onValueChange = { onClick() })
                    } else {
                        Modifier.selectable(selected = picked, enabled = enabled, role = role, onClick = onClick)
                    },
                ).padding(horizontal = 14.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        NumberKey(marker, glyph, Modifier.alignByBaseline())
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
    glyph: Painter?,
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
        // A glyph keeps the digit's size and baseline, so its key lines up with the option's words.
        Text(
            text = number.toString(),
            modifier = Modifier.padding(horizontal = 6.dp),
            color = if (glyph == null) MaterialTheme.colorScheme.onSurfaceVariant else Color.Transparent,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
        glyph?.let {
            Icon(
                it,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
internal fun TagBesideOrUnder(
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
        val besideWidth = max(0, width - gap - tagWidth)
        val text = words.firstOrNull()
        val beside =
            tagPlaceable == null ||
                text == null ||
                (
                    text.minIntrinsicWidth(constraints.maxHeight) <= besideWidth &&
                        max(text.minIntrinsicHeight(besideWidth), tagHeight) <= text.minIntrinsicHeight(width) + gap / 2 + tagHeight
                )
        val wordsWidth = if (beside && tagPlaceable != null) besideWidth else width
        val wordsPlaceable = text?.measure(constraints.copy(minWidth = 0, maxWidth = wordsWidth))
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
