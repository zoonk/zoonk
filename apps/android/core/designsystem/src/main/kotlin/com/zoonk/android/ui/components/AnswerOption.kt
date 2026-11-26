package com.zoonk.android.ui.components

import android.content.res.Configuration
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.AlignmentLine
import androidx.compose.ui.layout.FirstBaseline
import androidx.compose.ui.layout.LastBaseline
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.ParentDataModifier
import androidx.compose.ui.layout.VerticalAlignmentLine
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
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
 * One option of a question (main's `AnswerOption`): its number key (for keyboards, where the key picks it
 * ([LocalOptionKeys]), so TalkBack skips it), its words (in `labelLarge`, main's 15/500, unless the content sets its own) and,
 * once checked, the word its result shows. An option among several
 * picks is a [Role.Checkbox], one that acts at once is a [Role.Button], and one shown after the
 * fact has no role and nothing to press; [tag] replaces the
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
    role: Role? = Role.RadioButton,
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
    // Once checked or locked the key does nothing, so it hides in its room and the words stay put, as main's does.
    val key = answerKey(LocalConfiguration.current.keyboard, result != null || !enabled, tag != null, keyed = LocalOptionKeys.current)
    val label = MaterialTheme.typography.labelLarge
    val optionStyle = label.copy(lineBreak = label.lineBreak.copy(strategy = LineBreak.Strategy.Simple))
    val shownTag: (@Composable () -> Unit)? =
        tag ?: when {
            result != null -> {
                { AnswerTag(picked, result, guessed = guessed) }
            }

            picked && guessed && role != Role.Button -> {
                { GuessTag() }
            }

            else -> {
                null
            }
        }

    TagBesideOrUnder(
        modifier =
            modifier
                .keptWhole()
                .fillMaxWidth()
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .then(
                    when (role) {
                        null -> Modifier.semantics(mergeDescendants = true) {}
                        Role.Checkbox -> Modifier.toggleable(value = picked, enabled = enabled, role = role, onValueChange = { onClick() })
                        Role.Button -> Modifier.clickable(enabled = enabled, role = role, onClick = onClick)
                        else -> Modifier.selectable(selected = picked, enabled = enabled, role = role, onClick = onClick)
                    },
                ).padding(horizontal = 16.dp, vertical = 13.dp),
        content = { ProvideTextStyle(optionStyle, content) },
        tag = shownTag ?: {},
        leading =
            if (key ==
                AnswerKey.None
            ) {
                null
            } else {
                { OptionKey(marker, picked && result == null, Modifier.alpha(if (key == AnswerKey.Visible) 1f else 0f), glyph) }
            },
        leadingAtTop = keyAtTop,
        readingContent = readingContent?.let { reading -> { ProvideTextStyle(optionStyle, reading) } },
        onReadingOverflow = onReadingOverflow,
    )
}

/** The number key that picks an option or a card, in ink once [picked]; a [glyph] takes the digit's place. */
@Composable
fun OptionKey(
    number: Int,
    picked: Boolean,
    modifier: Modifier = Modifier,
    glyph: Painter? = null,
) {
    // A picked option's key turns ink: the option's mark, as a radio's dot is.
    val ink = MaterialTheme.colorScheme.onSurface
    Box(
        modifier =
            modifier
                .clearAndSetSemantics {}
                .defaultMinSize(minWidth = 20.dp, minHeight = 20.dp)
                .background(if (picked) ink else ink.copy(alpha = 0.04f), RoundedCornerShape(ZoonkRadius.sm))
                .border(1.dp, if (picked) Color.Transparent else ink.copy(alpha = 0.12f), RoundedCornerShape(ZoonkRadius.sm)),
        contentAlignment = Alignment.Center,
    ) {
        // A glyph keeps the digit's size and baseline, so its key lines up with the option's words. Every key is as
        // wide as its widest digit, so a "1" doesn't start its option's words before a "2" does.
        val style = MaterialTheme.typography.labelSmall.withTabularFigures()
        val text = number.toString()
        val measurer = rememberTextMeasurer()
        val widest =
            remember(
                style,
                text.length,
                measurer,
            ) { ('0'..'9').maxOf { measurer.measure(it.toString().repeat(text.length), style).size.width } }
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 4.dp).widthIn(min = with(LocalDensity.current) { widest.toDp() }),
            color =
                if (glyph !=
                    null
                ) {
                    Color.Transparent
                } else if (picked) {
                    MaterialTheme.colorScheme.surface
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            textAlign = TextAlign.Center,
            style = style,
        )
        glyph?.let {
            Icon(
                it,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = if (picked) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Code as an option's words: its tag holds the edge, on its last line when that line leaves room and under it otherwise. */
internal object CodeWords : ParentDataModifier {
    override fun Density.modifyParentData(parentData: Any?): Any = this@CodeWords
}

/** Where code's last line ends, from its start. */
internal val CodeLastLineEnd = VerticalAlignmentLine(::max)

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
        // Code keeps its shape at the content's width, so its tag ends its last line at the edge while that line leaves
        // room; code never wraps to make room.
        val codePlaceable = text?.takeIf { it.parentData == CodeWords }?.measure(loose.copy(maxWidth = contentWidth))
        val isCode = codePlaceable != null
        // Beside whenever the words' longest word fits there, so the options of one list never put it two ways.
        val beside =
            tagPlaceable == null || text == null ||
                if (codePlaceable != null) {
                    (codePlaceable[CodeLastLineEnd].takeIf { it != AlignmentLine.Unspecified } ?: codePlaceable.width) <= besideWidth
                } else {
                    text.minIntrinsicWidth(constraints.maxHeight) <= besideWidth
                }
        val wordsWidth = if (beside && tagPlaceable != null) besideWidth else contentWidth
        val wordsPlaceable = codePlaceable ?: text?.measure(loose.copy(maxWidth = wordsWidth))
        val wordsHeight = wordsPlaceable?.height ?: 0
        val wordsBaseline = wordsPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
        // Beside code, the tag sits on its last line, as it follows the last of an answer's words.
        val tagLine = if (isCode) wordsPlaceable?.get(LastBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0 else wordsBaseline
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
                contentY + max(0, tagLine - tagBaseline)
            } else {
                max(contentY + wordsHeight, if (tagAcross) keyBottom else 0) + gap / 2
            }
        val height = max(max(wordsHeight + contentY, keyBottom), tagY + tagHeight)

        layout(width, max(height, constraints.minHeight)) {
            keyPlaceable?.placeRelative(0, keyY)
            wordsPlaceable?.placeRelative(contentX, contentY)
            when {
                beside -> {
                    tagPlaceable?.placeRelative(width - tagWidth, tagY)
                }

                // Under code, the tag keeps the edge it holds on code's last line.
                isCode -> {
                    tagPlaceable.placeRelative(width - tagWidth, tagY)
                }

                else -> {
                    tagPlaceable.placeRelative(if (tagAcross) 0 else contentX, tagY)
                }
            }
        }
    }
}

internal enum class AnswerKey { None, Hidden, Visible }

/** Whether what's here shows its number keys: a keyboard is attached and a key picks it ([LocalOptionKeys]). */
@Composable
fun optionKeysShown(): Boolean =
    answerKey(LocalConfiguration.current.keyboard, checked = false, ordered = false, keyed = LocalOptionKeys.current) != AnswerKey.None

/** An option's number key: only with a keyboard, where the key picks it ([keyed]) and the option isn't a place in an order. */
internal fun answerKey(
    keyboard: Int,
    checked: Boolean,
    ordered: Boolean,
    keyed: Boolean,
): AnswerKey =
    when {
        !keyed || keyboard == Configuration.KEYBOARD_NOKEYS || keyboard == Configuration.KEYBOARD_UNDEFINED || ordered -> AnswerKey.None
        checked -> AnswerKey.Hidden
        else -> AnswerKey.Visible
    }
