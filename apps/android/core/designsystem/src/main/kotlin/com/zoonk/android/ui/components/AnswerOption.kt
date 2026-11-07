package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.material3.ProvideTextStyle
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
import com.zoonk.android.ui.theme.ZoonkRadius
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
 * skips it), its words (in `labelLarge`, main's 15/500, unless the content sets its own) and,
 * once checked, the word its result shows. An option among several
 * picks is a [Role.Checkbox], and one that acts at once is a [Role.Button]; [tag] replaces the
 * result's word (an order step's place). A [glyph] marks the key in place of its number, as main's
 * net-scored statements (✓, ✗, –). The key sits on the words' first line, or at the top with
 * [keyAtTop]. [readingContent] supplies a picture's caption for intrinsic sizing without placing a
 * second copy.
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
    keyAtTop: Boolean = false,
    guessed: Boolean = false,
    readingContent: (@Composable () -> Unit)? = null,
    onReadingOverflow: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(ZoonkRadius.option)

    TagBesideOrUnder(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .then(
                    when (role) {
                        Role.Checkbox -> Modifier.toggleable(value = picked, enabled = enabled, role = role, onValueChange = { onClick() })
                        Role.Button -> Modifier.clickable(enabled = enabled, role = role, onClick = onClick)
                        else -> Modifier.selectable(selected = picked, enabled = enabled, role = role, onClick = onClick)
                    },
                ).padding(horizontal = 14.dp, vertical = 13.dp),
        content = { ProvideTextStyle(MaterialTheme.typography.labelLarge, content) },
        tag = tag ?: { if (result != null) AnswerTag(picked, result, guessed = guessed) },
        leading = { NumberKey(marker, glyph, Modifier) },
        leadingAtTop = keyAtTop,
        readingContent = readingContent?.let { reading -> { ProvideTextStyle(MaterialTheme.typography.labelLarge, reading) } },
        onReadingOverflow = onReadingOverflow,
    )
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
                .defaultMinSize(minWidth = 20.dp, minHeight = 20.dp)
                .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.04f), RoundedCornerShape(ZoonkRadius.sm))
                .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f), RoundedCornerShape(ZoonkRadius.sm)),
        contentAlignment = Alignment.Center,
    ) {
        // A glyph keeps the digit's size and baseline, so its key lines up with the option's words.
        Text(
            text = number.toString(),
            modifier = Modifier.padding(horizontal = 4.dp),
            color = if (glyph == null) MaterialTheme.colorScheme.onSurfaceVariant else Color.Transparent,
            style = MaterialTheme.typography.labelSmall.withTabularFigures(),
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
fun TagBesideOrUnder(
    modifier: Modifier,
    content: @Composable () -> Unit,
    tag: @Composable () -> Unit,
    leading: (@Composable () -> Unit)? = null,
    leadingAtTop: Boolean = false,
    readingContent: (@Composable () -> Unit)? = null,
    onReadingOverflow: (() -> Unit)? = null,
) {
    Layout(
        contents =
            listOf(
                content,
                tag,
                leading ?: {
                },
                {
                    if (readingContent != null) {
                        Box(Modifier.clearAndSetSemantics {}) { readingContent() }
                    }
                },
            ),
        modifier = modifier,
    ) { (words, tags, keys, readings), constraints ->
        val gap = 12.dp.roundToPx()
        val width = constraints.maxWidth
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val text = words.firstOrNull()
        val keyPlaceable = keys.firstOrNull()?.measure(loose)
        val reading = readings.firstOrNull() ?: text.takeUnless { leadingAtTop }
        val textMinimum = if (keyPlaceable == null) 0 else reading?.minIntrinsicWidth(constraints.maxHeight) ?: 0
        val besideKeyWidth = max(0, width - (keyPlaceable?.width ?: 0) - gap)
        val keyBeside =
            keyPlaceable != null &&
                (textMinimum > width || textMinimum <= besideKeyWidth)
        val contentWidth = if (keyBeside) besideKeyWidth else width
        val contentX = width - contentWidth
        val label = tags.firstOrNull()
        val tagMinimum = label?.minIntrinsicWidth(constraints.maxHeight) ?: 0
        if (readings.isNotEmpty() && max(textMinimum, tagMinimum) > width) {
            onReadingOverflow?.invoke()
        }
        val tagAcross = tagMinimum > contentWidth
        val tagPlaceable = label?.measure(loose.copy(maxWidth = if (tagAcross) width else contentWidth))
        val tagWidth = tagPlaceable?.width ?: 0
        val tagHeight = tagPlaceable?.height ?: 0
        val besideWidth = max(0, contentWidth - gap - tagWidth)
        val beside =
            tagPlaceable == null ||
                text == null ||
                (
                    text.minIntrinsicWidth(constraints.maxHeight) <= besideWidth &&
                        max(text.minIntrinsicHeight(besideWidth), tagHeight) <= text.minIntrinsicHeight(contentWidth) + gap / 2 + tagHeight
                )
        val wordsWidth = if (beside && tagPlaceable != null) besideWidth else contentWidth
        val wordsPlaceable = text?.measure(loose.copy(maxWidth = wordsWidth))
        val wordsHeight = wordsPlaceable?.height ?: 0
        val wordsBaseline = wordsPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
        val keyBaseline = keyPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
        val keyY = if (keyBeside && !leadingAtTop) max(0, wordsBaseline - keyBaseline) else 0
        val contentY =
            when {
                keyPlaceable == null -> 0
                !keyBeside -> keyPlaceable.height + gap / 2
                leadingAtTop -> 0
                else -> max(0, keyBaseline - wordsBaseline)
            }
        val keyBottom = (keyPlaceable?.height ?: 0) + keyY
        val tagBaseline = tagPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
        val tagY =
            if (beside) {
                contentY + max(0, wordsBaseline - tagBaseline)
            } else {
                max(contentY + wordsHeight, if (tagAcross) keyBottom else 0) + gap / 2
            }
        val height = max(max(wordsHeight + contentY, keyBottom), tagY + tagHeight)

        layout(width, max(height, constraints.minHeight)) {
            keyPlaceable?.placeRelative(0, keyY)
            wordsPlaceable?.placeRelative(contentX, contentY)
            if (beside) {
                tagPlaceable?.placeRelative(width - tagWidth, tagY)
            } else {
                tagPlaceable.placeRelative(if (tagAcross) 0 else contentX, tagY)
            }
        }
    }
}
