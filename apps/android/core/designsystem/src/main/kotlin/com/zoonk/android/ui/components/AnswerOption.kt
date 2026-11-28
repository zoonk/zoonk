package com.zoonk.android.ui.components

import android.content.res.Configuration
import androidx.annotation.DrawableRes
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.AlignmentLine
import androidx.compose.ui.layout.FirstBaseline
import androidx.compose.ui.layout.LastBaseline
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.ParentDataModifier
import androidx.compose.ui.layout.VerticalAlignmentLine
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
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
 * ([LocalOptionKeys]), so TalkBack skips it), its words (in `labelLarge`, main's 15/500, unless the content sets its own),
 * once checked the word its result shows, and the mark of a pick at its end. An option among several picks is a
 * [Role.Checkbox] and ends with a checkbox, one of a pick-one question a [Role.RadioButton] with a radio, so their shape
 * says which before a tap; one that acts at once is a [Role.Button], and one shown after the fact has no role and
 * nothing to press, and neither has a mark. With a keyboard, Space picks a checkbox or radio option and Enter goes on
 * to the screen's main action, as in main's forms, unless the option [keepsEnter] (a warm-up's guess, final at once),
 * where Enter picks it too. [tag] replaces the result's word (an order step's place). A [glyph] marks the option in
 * place of a number key, on every device, as main's review does (✓, ✗). The key and the mark sit on the words' first
 * line; a [stacked] card, a picture's, takes them over its picture's top corners. [readingContent] supplies a picture's
 * caption for intrinsic sizing without placing a second copy.
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
    keepsEnter: Boolean = false,
    tag: (@Composable () -> Unit)? = null,
    glyph: Painter? = null,
    stacked: Boolean = false,
    guessed: Boolean = false,
    readingContent: (@Composable () -> Unit)? = null,
    onReadingOverflow: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(ZoonkRadius.option)
    // Once checked a number key does nothing, so its room shows the verdict's mark and the words stay put, as main's
    // does; a locked option without one hides its key.
    val key =
        if (glyph != null) {
            AnswerKey.Visible
        } else {
            answerKey(LocalConfiguration.current.keyboard, result != null || !enabled, tag != null, keyed = LocalOptionKeys.current)
        }
    val keyGlyph = result?.let { painterResource(it.glyph()) } ?: glyph
    val several = role == Role.Checkbox
    val marked = several || role == Role.RadioButton
    val interactions = remember { MutableInteractionSource() }
    val indication = LocalIndication.current
    val inputModes = LocalInputModeManager.current
    val label = MaterialTheme.typography.labelLarge
    val optionStyle = label.copy(lineBreak = label.lineBreak.copy(strategy = LineBreak.Strategy.Simple))
    val shownTag: (@Composable () -> Unit)? = tag ?: result?.let { checked -> { AnswerTag(picked, checked, guessed = guessed) } }

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
                        null -> {
                            Modifier.semantics(mergeDescendants = true) {}
                        }

                        Role.Button -> {
                            Modifier.clickable(enabled = enabled, role = role, onClick = onClick)
                        }

                        else -> {
                            val pick =
                                if (several) {
                                    Modifier.toggleable(picked, interactions, indication, enabled, role) { onClick() }
                                } else {
                                    Modifier.selectable(picked, interactions, indication, enabled, role, onClick)
                                }
                            if (keepsEnter) {
                                pick
                            } else {
                                Modifier.passingEnter(enabled, interactions, inputModes::inputMode, onClick).then(pick)
                            }
                        }
                    },
                ).padding(if (stacked) PaddingValues(STACKED_PADDING) else PaddingValues(horizontal = 16.dp, vertical = 13.dp)),
        content = { ProvideTextStyle(optionStyle, content) },
        tag = shownTag ?: {},
        leading =
            if (key == AnswerKey.None) {
                null
            } else {
                {
                    // Where an option has its mark, the mark shows the pick, so its key stays a key.
                    OptionKey(
                        marker,
                        picked && result == null && !marked,
                        Modifier
                            .alpha(if (key == AnswerKey.Visible || result != null) 1f else 0f)
                            .then(
                                if (stacked) {
                                    Modifier.background(
                                        MaterialTheme.colorScheme.surface,
                                        RoundedCornerShape(ZoonkRadius.sm),
                                    )
                                } else {
                                    Modifier
                                },
                            ),
                        keyGlyph,
                    )
                }
            },
        mark = if (marked) ({ AnswerMark(picked, several, optionStyle, onPicture = stacked) }) else null,
        stacked = stacked,
        readingContent = readingContent?.let { reading -> { ProvideTextStyle(optionStyle, reading) } },
        onReadingOverflow = onReadingOverflow,
    )
}

/**
 * A checkbox or radio option's keyboard stop, outside its pick, so Enter goes on to the screen's main action while Space
 * or a D-pad's center picks. Only a keyboard focuses it, as it does Compose's own controls.
 */
private fun Modifier.passingEnter(
    enabled: Boolean,
    interactions: MutableInteractionSource,
    inputMode: () -> InputMode,
    onPick: () -> Unit,
): Modifier =
    focusProperties { canFocus = inputMode() == InputMode.Keyboard }
        .focusable(enabled, interactions)
        .onKeyEvent { event ->
            val picks = event.key == Key.Spacebar || event.key == Key.DirectionCenter
            if (picks && event.type == KeyEventType.KeyDown && event.nativeKeyEvent.repeatCount == 0) onPick()
            picks
        }.focusProperties { canFocus = false }

/**
 * A pick at an option's end, as the app's choice lists end theirs: a radio where one answer counts, a checkbox where
 * several do, empty until picked and filled after, verdict included. The option is the control, so TalkBack hears it
 * once. Beside words it's one [line] of them tall, so it centers on their first line; on a picture, a disc of the
 * surface keeps it clear over any image.
 */
@Composable
private fun AnswerMark(
    picked: Boolean,
    several: Boolean,
    line: TextStyle,
    onPicture: Boolean,
) {
    Box(
        Modifier
            .clearAndSetSemantics {}
            .then(if (onPicture) Modifier.size(MARK_DISC).background(MaterialTheme.colorScheme.surface, CircleShape) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        if (!onPicture) Text(" ", style = line)
        if (several) {
            Checkbox(checked = picked, onCheckedChange = null, modifier = Modifier.controlInk(vertically = true))
        } else {
            RadioButton(selected = picked, onClick = null, modifier = Modifier.controlInk(vertically = true))
        }
    }
}

@DrawableRes
private fun AnswerResult.glyph(): Int =
    when (this) {
        AnswerResult.Right -> R.drawable.ic_check
        AnswerResult.Guess -> R.drawable.ic_remove
        AnswerResult.Wrong -> R.drawable.ic_close
    }

/**
 * The number key that picks an option or a card, in ink once [picked]. A [glyph], such as a verdict's mark, takes the
 * digit's room bare, in the words' color, so beside a checkbox it never reads as a ticked one.
 */
@Composable
fun OptionKey(
    number: Int,
    picked: Boolean,
    modifier: Modifier = Modifier,
    glyph: Painter? = null,
) {
    // A picked option's key turns ink: the option's mark, as a radio's dot is.
    val ink = MaterialTheme.colorScheme.onSurface
    val keyShape = RoundedCornerShape(ZoonkRadius.sm)
    Box(
        modifier =
            modifier
                .clearAndSetSemantics {}
                .defaultMinSize(minWidth = 20.dp, minHeight = 20.dp)
                .then(
                    if (glyph != null) {
                        Modifier
                    } else {
                        Modifier
                            .background(if (picked) ink else ink.copy(alpha = 0.04f), keyShape)
                            .border(1.dp, if (picked) Color.Transparent else ink.copy(alpha = 0.12f), keyShape)
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        // A glyph keeps the digit's size and baseline, so its key lines up with the option's words. The digits are
        // mono, so a "1" doesn't start its option's words before a "2" does.
        Text(
            text = number.toString(),
            modifier = Modifier.padding(horizontal = 4.dp),
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
            style = MaterialTheme.zoonkType.key,
        )
        glyph?.let { Icon(it, contentDescription = null, modifier = Modifier.size(16.dp), tint = LocalContentColor.current) }
    }
}

/** Code as an option's words: its tag holds the edge, on its last line when that line leaves room and under it otherwise. */
internal object CodeWords : ParentDataModifier {
    override fun Density.modifyParentData(parentData: Any?): Any = this@CodeWords
}

/** Where code's last line ends, from its start. */
internal val CodeLastLineEnd = VerticalAlignmentLine(::max)

/**
 * An option's parts: its [leading] key, its words, the [tag] that follows them (beside their end while their longest
 * word leaves room, under them otherwise) and the [mark] at its end, in a column of its own so the words never move
 * under it. The key and the mark sit on the words' first line. A [stacked] card is a picture's: the key and the mark
 * take its top corners and the tag ends the card, under the picture.
 */
@Composable
fun TagBesideOrUnder(
    modifier: Modifier,
    content: @Composable () -> Unit,
    tag: @Composable () -> Unit,
    leading: (@Composable () -> Unit)? = null,
    mark: (@Composable () -> Unit)? = null,
    stacked: Boolean = false,
    readingContent: (@Composable () -> Unit)? = null,
    onReadingOverflow: (() -> Unit)? = null,
) {
    Layout(
        contents =
            listOf(
                content,
                tag,
                leading ?: {},
                mark ?: {},
                {
                    if (readingContent != null) {
                        Box(Modifier.clearAndSetSemantics {}) { readingContent() }
                    }
                },
            ),
        modifier = modifier,
    ) { (words, tags, keys, marks, readings), constraints ->
        val gap = 12.dp.roundToPx()
        val width = constraints.maxWidth
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val text = words.firstOrNull()
        val keyPlaceable = keys.firstOrNull()?.measure(loose)
        val markPlaceable = marks.firstOrNull()?.measure(loose)
        val label = tags.firstOrNull()
        val tagMinimum = label?.minIntrinsicWidth(constraints.maxHeight) ?: 0

        if (stacked) {
            val reading = readings.firstOrNull()
            if (reading != null && max(reading.minIntrinsicWidth(constraints.maxHeight), tagMinimum) > width) {
                onReadingOverflow?.invoke()
            }
            val inset = STACKED_CORNER_INSET.roundToPx()
            val picture = text?.measure(loose.copy(maxWidth = width))
            val pictureHeight = picture?.height ?: 0
            val tagPlaceable = label?.measure(loose.copy(maxWidth = width))
            val tagY = pictureHeight + STACKED_PADDING.roundToPx()
            val height = if (tagPlaceable == null) pictureHeight else tagY + tagPlaceable.height

            return@Layout layout(width, max(height, constraints.minHeight)) {
                picture?.placeRelative(0, 0)
                tagPlaceable?.placeRelative(width - tagPlaceable.width, tagY)
                keyPlaceable?.placeRelative(inset, inset)
                markPlaceable?.placeRelative(width - markPlaceable.width - inset, inset)
            }
        }

        // The mark keeps its column from the first frame, so a pick or a verdict moves no word.
        val inner = max(0, width - (markPlaceable?.let { it.width + gap } ?: 0))
        val reading = readings.firstOrNull() ?: text
        val textMinimum = if (keyPlaceable == null) 0 else reading?.minIntrinsicWidth(constraints.maxHeight) ?: 0
        val besideKeyWidth = max(0, inner - (keyPlaceable?.width ?: 0) - gap)
        val keyBeside =
            keyPlaceable != null &&
                (textMinimum > inner || textMinimum <= besideKeyWidth)
        val contentWidth = if (keyBeside) besideKeyWidth else inner
        val contentX = inner - contentWidth
        if (readings.isNotEmpty() && max(textMinimum, tagMinimum) > inner) {
            onReadingOverflow?.invoke()
        }
        val tagAcross = tagMinimum > contentWidth
        val tagPlaceable = label?.measure(loose.copy(maxWidth = if (tagAcross) inner else contentWidth))
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
        val keyY = if (keyBeside) max(0, wordsBaseline - keyBaseline) else 0
        val contentY =
            when {
                keyPlaceable == null -> 0
                !keyBeside -> keyPlaceable.height + gap / 2
                else -> max(0, keyBaseline - wordsBaseline)
            }
        val keyBottom = (keyPlaceable?.height ?: 0) + keyY
        val markBaseline = markPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
        // Its line of words on their first line, as the key's digit is.
        val markY = contentY + wordsBaseline - markBaseline
        val markBottom = (markPlaceable?.height ?: 0) + markY
        val tagBaseline = tagPlaceable?.get(FirstBaseline)?.takeIf { it != AlignmentLine.Unspecified } ?: 0
        val tagY =
            if (beside) {
                contentY + max(0, tagLine - tagBaseline)
            } else {
                max(contentY + wordsHeight, if (tagAcross) keyBottom else 0) + gap / 2
            }
        val height = maxOf(wordsHeight + contentY, keyBottom, markBottom, tagY + tagHeight)

        layout(width, max(height, constraints.minHeight)) {
            keyPlaceable?.placeRelative(0, keyY)
            wordsPlaceable?.placeRelative(contentX, contentY)
            markPlaceable?.placeRelative(width - markPlaceable.width, markY)
            when {
                beside -> {
                    tagPlaceable?.placeRelative(inner - tagWidth, tagY)
                }

                // Under code, the tag keeps the edge it holds on code's last line.
                isCode -> {
                    tagPlaceable.placeRelative(inner - tagWidth, tagY)
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

/** Main's stacked card, `p-2`: its picture nearly fills it. */
private val STACKED_PADDING = 8.dp

/** Main's key over a picture, `top-3 left-3` on a `p-2` card: just inside the picture's corner. */
private val STACKED_CORNER_INSET = 4.dp

/** The disc under a mark over a picture. */
private val MARK_DISC = 28.dp
