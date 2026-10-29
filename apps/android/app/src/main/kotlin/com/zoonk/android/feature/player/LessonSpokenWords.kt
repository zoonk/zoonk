package com.zoonk.android.feature.player

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.ListenButton
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.player.model.SpokenHeard
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.api.models.SpokenPracticeWord
import com.zoonk.api.models.SpokenWordResult

/** The app's one speech player, for the lesson's listen buttons; none in previews and tests. */
val LocalLessonSpeech = staticCompositionLocalOf<SpeechPlayer?> { null }

/**
 * Main's `LessonSpokenWords`: each word as it was heard, and the words to practice, which say
 * themselves when picked, normally then slowly.
 */
@Composable
internal fun SpokenWords(
    heard: SpokenHeard,
    language: String,
) {
    val practice = heard.wordsToPractice
    var selected by rememberSaveable { mutableIntStateOf(0) }
    val word = practice.getOrNull(selected)
    val speech = LocalLessonSpeech.current
    val audio = speech?.let { rememberSpokenAudio(it, language) }
    val slowAudio = speech?.let { rememberSpokenAudio(it, language) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.player_what_we_heard),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            heard.words.forEach { item ->
                val index = practice.indexOfFirst { it.text == item.text }
                if (index == -1) {
                    HeardWord(item, language)
                } else {
                    PracticeWord(item, language, selected = index == selected) {
                        selected = index
                        val sound = listOf(practice[index].spoken())
                        audio?.speak(sound, onDone = { slowAudio?.speak(sound, SpeechPlayer.SLOW_RATE) })
                    }
                }
            }
        }
        if (word != null) {
            PracticePanel(word) {
                if (audio != null && slowAudio != null) {
                    ListenButton(audio, listOf(word.spoken()), stringResource(R.string.player_listen))
                    ListenButton(
                        slowAudio,
                        listOf(word.spoken()),
                        stringResource(R.string.player_slowly),
                        rate = SpeechPlayer.SLOW_RATE,
                        icon = R.drawable.ic_slow_motion_video,
                    )
                }
            }
        }
    }
}

private fun SpokenPracticeWord.spoken() = SpokenText(text, recording = audioUrl)

@Composable
private fun wordDescription(word: SpokenWordResult): String =
    when (word.status) {
        SpokenWordResult.Status.CORRECT -> word.text
        SpokenWordResult.Status.MISSED -> stringResource(R.string.player_word_not_heard, word.text)
        SpokenWordResult.Status.DIFFERENT -> stringResource(R.string.player_word_heard_as, word.text, word.heard.orEmpty())
    }

@Composable
private fun HeardWord(
    word: SpokenWordResult,
    language: String,
) {
    val description = wordDescription(word)

    Text(
        text = word.text,
        modifier = Modifier.clearAndSetSemantics { contentDescription = description },
        color =
            when (word.status) {
                SpokenWordResult.Status.CORRECT -> MaterialTheme.colorScheme.tertiary
                SpokenWordResult.Status.DIFFERENT -> MaterialTheme.colorScheme.error
                SpokenWordResult.Status.MISSED -> MaterialTheme.colorScheme.onSurfaceVariant
            },
        style =
            MaterialTheme.typography.titleMedium.copy(
                localeList = LocaleList(language),
                textDecoration =
                    when (word.status) {
                        SpokenWordResult.Status.CORRECT -> null
                        SpokenWordResult.Status.DIFFERENT -> TextDecoration.Underline
                        SpokenWordResult.Status.MISSED -> TextDecoration.LineThrough
                    },
            ),
    )
}

@Composable
private fun PracticeWord(
    word: SpokenWordResult,
    language: String,
    selected: Boolean,
    onSelect: () -> Unit,
) {
    val description = wordDescription(word)
    val shape = RoundedCornerShape(6.dp)

    Surface(
        selected = selected,
        onClick = onSelect,
        color = MaterialTheme.colorScheme.errorContainer,
        shape = shape,
        border = if (selected) BorderStroke(2.dp, MaterialTheme.colorScheme.error) else null,
    ) {
        Text(
            text = word.text,
            modifier = Modifier.padding(horizontal = 4.dp).clearAndSetSemantics { contentDescription = description },
            color = MaterialTheme.colorScheme.onErrorContainer,
            style = MaterialTheme.typography.titleMedium.copy(localeList = LocaleList(language), textDecoration = TextDecoration.Underline),
        )
    }
}

@Composable
private fun PracticePanel(
    word: SpokenPracticeWord,
    listen: @Composable () -> Unit,
) {
    val line = MaterialTheme.colorScheme.outlineVariant
    val title = stringResource(R.string.player_how_to_say, word.text)

    Column(
        modifier =
            Modifier
                .semantics { paneTitle = title }
                .drawBehind {
                    val x = if (layoutDirection == LayoutDirection.Rtl) size.width else 0f
                    drawLine(line, Offset(x, 0f), Offset(x, size.height), strokeWidth = 2.dp.toPx())
                }.padding(start = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.Bottom) {
            Text(word.text, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            word.respelling?.let {
                Text(
                    stringResource(R.string.player_sounds_like, it),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { listen() }
        word.tip?.let { RichText(text = it, style = MaterialTheme.typography.bodyMedium) }
    }
}
