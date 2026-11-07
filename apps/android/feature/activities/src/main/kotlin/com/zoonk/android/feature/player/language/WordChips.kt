package com.zoonk.android.feature.player.language

import android.text.TextUtils
import android.view.View
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.steps.LocalPrimaryFocus
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.theme.ZoonkRadius
import java.util.Locale

/**
 * A word to place or placed (main's `WORD_CHIP_CLASS`), in the answer tones once checked. A [hidden]
 * word keeps its place as an empty muted slot, so the others don't move and the learner sees where
 * it goes back to.
 */
@Composable
internal fun WordChip(
    word: String,
    romanization: String?,
    language: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    result: AnswerResult? = null,
    enabled: Boolean = true,
    hidden: Boolean = false,
    clickLabel: String? = null,
) {
    val tone = answerTone(picked = false, result = result)
    val shape = RoundedCornerShape(ZoonkRadius.md)
    val slot =
        if (hidden) {
            Modifier
                .clearAndSetSemantics {}
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
        } else {
            Modifier
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .clickable(enabled = enabled, role = Role.Button, onClickLabel = clickLabel, onClick = onClick)
        }

    Column(
        modifier =
            modifier
                .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                .then(slot)
                .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(Modifier.alpha(if (hidden) 0f else 1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(targetText(word, language), style = MaterialTheme.typography.bodyLarge)
            Romanization(romanization)
        }
    }
}

/** Words in the language being learned, which TalkBack then reads in that language's voice. */
internal fun targetText(
    text: String,
    language: String,
) = buildAnnotatedString { withStyle(SpanStyle(localeList = LocaleList(language))) { append(text) } }

/**
 * Rows of words in the language being learned run in that language's direction, so a sentence in
 * Arabic or Hebrew reads right to left in an app that's left to right.
 */
@Composable
internal fun TargetDirection(
    language: String,
    content: @Composable () -> Unit,
) {
    val direction =
        if (TextUtils.getLayoutDirectionFromLocale(Locale.forLanguageTag(language)) == View.LAYOUT_DIRECTION_RTL) {
            LayoutDirection.Rtl
        } else {
            LayoutDirection.Ltr
        }
    CompositionLocalProvider(LocalLayoutDirection provides direction, content = content)
}

/**
 * The words to build an answer from. A placed word keeps its place in the bank, empty, so the
 * others don't move under the learner's finger.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun WordBank(
    words: List<WordBankOption>,
    used: List<Boolean>,
    enabled: Boolean,
    language: String,
    focus: WordBankFocus,
    onPlace: (Int) -> Unit,
) {
    val label = stringResource(R.string.player_language_word_bank)

    TargetDirection(language) {
        FlowRow(
            Modifier.semantics { contentDescription = label },
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            words.forEachIndexed { index, option ->
                WordChip(
                    word = option.word,
                    romanization = option.romanization,
                    language = language,
                    onClick = { onPlace(index) },
                    modifier = with(focus) { Modifier.tile(index) },
                    enabled = enabled,
                    hidden = used.getOrElse(index) { false },
                )
            }
        }
    }
}

/**
 * Main's word bank focus: a word placed or taken out with a keyboard would leave focus on the whole
 * screen, so the next Tab starts over at the top. A placed tile hands focus to the next tile left, else
 * the one before it, or to Check once the answer is complete; a word taken out hands it to the next
 * word in the answer, else the one before it, else the tile it went back to. A word pressed without
 * focus (a tap) leaves focus alone.
 */
@Stable
internal class WordBankFocus(
    private val primary: FocusRequester?,
) {
    private val tiles = mutableMapOf<Int, FocusRequester>()
    private val words = mutableMapOf<Int, FocusRequester>()
    private var focused: FocusRequester? = null
    var target by mutableStateOf<FocusRequester?>(null)

    fun Modifier.tile(index: Int) = follow(tiles.getOrPut(index, ::FocusRequester))

    fun Modifier.word(index: Int) = follow(words.getOrPut(index, ::FocusRequester))

    fun placed(
        index: Int,
        used: List<Boolean>,
        complete: Boolean,
    ) = moveTo(if (complete) primary else nearest(used.map { !it }, index)?.let { tiles[it] })

    fun removed(
        nextWord: Int?,
        usedBefore: List<Boolean>,
        usedAfter: List<Boolean>,
    ) = moveTo(
        nextWord?.let { words[it] } ?: usedBefore.indices.firstOrNull { usedBefore[it] && !usedAfter[it] }?.let { tiles[it] },
    )

    private fun Modifier.follow(requester: FocusRequester) =
        focusRequester(requester).onFocusChanged {
            if (it.isFocused) {
                focused = requester
            } else if (focused == requester) {
                focused = null
            }
        }

    private fun moveTo(requester: FocusRequester?) {
        if (focused != null) target = requester
    }
}

/** Check turns on only once the player has the answer, so a move to it waits for [answer]. */
@Composable
internal fun rememberWordBankFocus(answer: LessonAnswer?): WordBankFocus {
    val primary = LocalPrimaryFocus.current
    val focus = remember(primary) { WordBankFocus(primary) }

    LaunchedEffect(focus.target, answer) {
        if (focus.target?.requestFocus(FocusDirection.Enter) == true) focus.target = null
    }
    return focus
}

internal fun nearest(
    available: List<Boolean>,
    from: Int,
): Int? = (from + 1..available.lastIndex).firstOrNull { available[it] } ?: (from - 1 downTo 0).firstOrNull { available[it] }

/**
 * Which bank words are in use: a word placed from the bank marks its own tile; a word restored from
 * an earlier answer marks the first tiles with the same text.
 */
internal fun usedTiles(
    words: List<WordBankOption>,
    placed: List<PlacedWord>,
): List<Boolean> =
    words.mapIndexed { index, option ->
        placed.any { it.bankIndex == index } ||
            run {
                val untracked = placed.count { it.bankIndex == null && it.word == option.word }
                val occurrence = words.take(index + 1).count { it.word == option.word }
                untracked >= occurrence
            }
    }

/** [bankIndex] is null for a word restored from an earlier answer. */
internal data class PlacedWord(
    val word: String,
    val romanization: String?,
    val bankIndex: Int?,
)
