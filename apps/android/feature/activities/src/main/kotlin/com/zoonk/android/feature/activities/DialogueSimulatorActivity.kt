package com.zoonk.android.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.player.LocalLessonSpeech
import com.zoonk.android.feature.player.steps.ChoiceOption
import com.zoonk.android.feature.player.steps.ChoiceOptions
import com.zoonk.android.feature.questions.itemLine
import com.zoonk.android.ui.components.LearnerBubble
import com.zoonk.android.ui.richtext.RichTextLine
import com.zoonk.android.ui.richtext.SpokenText
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf21FieldsLinesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf21FieldsLinesInner.Speaker
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf21FieldsRepliesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf21Value as DialogueContent

private typealias DialogueLine = PlayableLibraryStepAnyOfContentOneOf21FieldsLinesInner

val dialogueSimulatorRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_reply, R.drawable.ic_forum) },
        canvas = { DialogueSimulatorActivity(it) },
        keyPick = { content, index ->
            (content as DialogueContent)
                .value.fields.replies
                .getOrNull(index)
                ?.let { selectionAnswer(listOf(it.id)) }
        },
    )

@Composable
private fun DialogueSimulatorActivity(props: ActivityProps) {
    val fields = (props.content as DialogueContent).value.fields
    val speech = LocalLessonSpeech.current
    val selectedId = props.answer.selectionIds?.firstOrNull()
    val expectedIds = props.expected.selectionIds.orEmpty()
    val best = fields.replies.firstOrNull { it.isBest }
    val conversationLabel = stringResource(R.string.activities_dialogue_conversation)

    ActivityCanvas(gap = 16.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val sceneStyle = MaterialTheme.typography.labelMedium
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LineMarker(sceneStyle) {
                    Icon(
                        painterResource(R.drawable.ic_location_on),
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(fields.scene, color = MaterialTheme.colorScheme.onSurfaceVariant, style = sceneStyle)
            }
            Column(Modifier.semantics { contentDescription = conversationLabel }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                fields.lines.forEach { ChatLine(it, speech, fields.language) }
            }
        }
        ChoiceOptions(
            options = fields.replies.map { ChoiceOption(it.id, it.text, it.id in expectedIds) },
            selectedId = selectedId,
            isChecked = props.isChecked,
            isGuess = false,
            locked = props.isLocked,
            keepsEveryOption = true,
            onSelect = { id -> props.onAnswerChange(id?.let { selectionAnswer(listOf(it)) }) },
            label = stringResource(R.string.activities_dialogue_your_reply),
        ) { option ->
            ReplyContent(fields.replies.first { it.id == option.id }, fields.language, props.isChecked)
        }
        if (props.isChecked && speech != null && best != null) {
            val label = stringResource(R.string.activities_dialogue_hear_best)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ActivitySpeakButton(rememberSpokenAudio(speech, fields.language), best.text, label)
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun ChatLine(
    line: DialogueLine,
    speech: SpeechPlayer?,
    language: String,
) {
    val isThem = line.speaker == Speaker.THEM
    val said = stringResource(if (isThem) R.string.activities_dialogue_they_say else R.string.activities_dialogue_you_said)
    val reading =
        Modifier.clearAndSetSemantics {
            text =
                buildAnnotatedString {
                    append("$said ")
                    append(spoken(line.text, language))
                    append(" ${line.translation}")
                }
        }
    val words: @Composable () -> Unit = {
        Column {
            Text(spoken(line.text, language), style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
            Text(line.translation, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }

    if (!isThem) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            LearnerBubble(Modifier.fillMaxWidth(BUBBLE_SHARE).wrapContentWidth(Alignment.End).then(reading), words)
        }
        return
    }

    val bubble =
        RoundedCornerShape(
            topStart = ZoonkRadius.option,
            topEnd = ZoonkRadius.option,
            bottomEnd = ZoonkRadius.option,
            bottomStart = 4.dp,
        )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
        val secondary = MaterialTheme.zoonk.vizSecondary
        Box(Modifier.size(36.dp).clip(CircleShape).background(secondary.copy(alpha = SOFT)), contentAlignment = Alignment.Center) {
            Icon(painterResource(R.drawable.ic_person), contentDescription = null, modifier = Modifier.size(16.dp), tint = secondary)
        }
        Box(
            Modifier
                .weight(1f, fill = false)
                .widthIn(min = 48.dp)
                .clip(bubble)
                .background(MaterialTheme.colorScheme.surface)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, bubble)
                .then(reading)
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) { words() }
        if (speech != null) {
            ActivitySpeakButton(rememberSpokenAudio(speech, language), line.text, stringResource(R.string.activities_dialogue_hear_line))
        }
    }
}

@Composable
private fun ReplyContent(
    reply: PlayableLibraryStepAnyOfContentOneOf21FieldsRepliesInner,
    language: String,
    isChecked: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(spoken(reply.text, language), style = MaterialTheme.typography.bodyLarge)
        if (isChecked) {
            Text(reply.translation, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            // Every reply stays to say why, so the best one is named, whichever was picked.
            val lead = stringResource(R.string.activities_dialogue_best_reply).takeIf { reply.isBest }
            val why = itemLine(reply.why)
            val line =
                buildAnnotatedString {
                    lead?.let {
                        withStyle(
                            SpanStyle(color = MaterialTheme.colorScheme.onTertiaryContainer, fontWeight = FontWeight.Medium),
                        ) { append(it) }
                        append(" ")
                    }
                    append(why.text)
                }
            RichTextLine(
                SpokenText(line, why.spoken?.let { listOfNotNull(lead, it).joinToString(" ") }),
                Modifier,
                MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private const val SOFT = 0.16f
private const val BUBBLE_SHARE = 0.8f

/** Words in the language being learned, marked so TalkBack voices them in it. */
private fun spoken(
    text: String,
    language: String,
) = buildAnnotatedString { withStyle(SpanStyle(localeList = LocaleList(language))) { append(text) } }
