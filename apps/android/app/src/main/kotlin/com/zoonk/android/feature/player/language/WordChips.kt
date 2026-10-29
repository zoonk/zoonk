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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
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
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
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
    val shape = RoundedCornerShape(8.dp)
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
                    enabled = enabled,
                    hidden = used.getOrElse(index) { false },
                )
            }
        }
    }
}

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
