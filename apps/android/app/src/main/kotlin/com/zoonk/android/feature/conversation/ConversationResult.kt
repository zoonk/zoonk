package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.ListenButton
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.LanguageCallFeedback
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationResult
import com.zoonk.api.models.LanguageConversationResultFeedback

/**
 * Main's call result, a step at a time: the stars with what the call earned, what went well, and
 * what to improve (one better way to say something, goals still to get across, words to practice).
 */
@Composable
internal fun ConversationResult(
    conversation: LanguageConversation,
    result: LanguageConversationResult,
    speech: SpeechPlayer,
    onContinue: () -> Unit,
    onClose: () -> Unit,
    onSeePlus: () -> Unit,
) {
    val feedback = (result.feedback as? LanguageConversationResultFeedback.CallWrapper)?.value
    val language = conversation.targetLanguage
    val met = conversation.objectives.filter { it.met }
    val missed = conversation.objectives.filterNot { it.met }
    val steps =
        buildList<@Composable ColumnScope.() -> Unit> {
            add { StarsStep(conversation, result, feedback, onSeePlus) }
            if (met.isNotEmpty() || feedback?.wentWell.orEmpty().isNotEmpty()) {
                add { WentWellStep(feedback, language, met.map { it.label }) }
            }
            if (missed.isNotEmpty() || feedback?.improve != null || feedback?.pronunciation.orEmpty().isNotEmpty()) {
                add { ImproveStep(feedback, language, missed.map { it.label }, speech) }
            }
        }
    var index by rememberSaveable { mutableIntStateOf(0) }
    val shown = index.coerceIn(0, steps.lastIndex)

    CallFrame(
        title = conversationTitle(conversation),
        onClose = onClose,
        bottomBar = {
            StepPagerActions(steps.size, shown, onIndexChange = { index = it }) {
                Button(onClick = onContinue) { Text(stringResource(R.string.steps_continue)) }
            }
        },
    ) {
        item(key = "step-$shown") {
            Column(Modifier.callItem(), verticalArrangement = Arrangement.spacedBy(20.dp)) { steps[shown]() }
        }
    }
}

@Composable
private fun StarsStep(
    conversation: LanguageConversation,
    result: LanguageConversationResult,
    feedback: LanguageCallFeedback?,
    onSeePlus: () -> Unit,
) {
    val checkpoint = conversation.kind == LanguageConversation.Kind.CHECKPOINT
    val lost = checkpoint && !result.passed
    val stars = result.stars.toInt()
    val starsLabel = pluralStringResource(R.plurals.conversation_stars, stars, stars)

    Row(
        Modifier.clearAndSetSemantics { contentDescription = starsLabel },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(painterResource(R.drawable.ic_star_filled), contentDescription = null, tint = MaterialTheme.colorScheme.tertiary)
        Readout("$stars/$MAX_STARS")
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            if (checkpoint) conversation.title else conversationTitle(conversation),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        val headline =
            when {
                !checkpoint -> conversation.title
                result.passed -> stringResource(R.string.conversation_challenge_passed)
                else -> stringResource(R.string.conversation_not_this_time)
            }
        Text(headline, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        feedback?.encouragement?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }

    CallFacts(conversation, result)

    when {
        lost && conversation.locked -> {
            PlusNotice(onSeePlus = onSeePlus, description = stringResource(R.string.conversation_challenge_plus))
        }

        lost -> {
            Note(stringResource(R.string.conversation_try_again_later))
        }

        result.stars < MAX_STARS -> {
            Note(stringResource(R.string.conversation_stars_rule))
        }
    }
}

@Composable
private fun CallFacts(
    conversation: LanguageConversation,
    result: LanguageConversationResult,
) {
    val locale = currentLocale()
    val total = conversation.objectives.size
    val met = conversation.objectives.count { it.met }
    if (total == 0 && result.brainPower <= 0) return

    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (total > 0) {
            val spoken =
                stringResource(
                    R.string.conversation_goals_met,
                    formatNumber(met.toDouble(), locale),
                    formatNumber(total.toDouble(), locale),
                )
            Fact(
                R.drawable.ic_target,
                MaterialTheme.colorScheme.tertiary,
                stringResource(R.string.conversation_goals_tile),
                "$met/$total",
                spoken,
            )
        }
        if (result.brainPower > 0) {
            val points = "+" + formatNumber(result.brainPower.toDouble(), locale)
            Fact(R.drawable.ic_psychology, MaterialTheme.zoonk.brain, stringResource(R.string.conversation_brain_power), points, points)
        }
    }
}

@Composable
private fun Fact(
    icon: Int,
    tint: androidx.compose.ui.graphics.Color,
    label: String,
    value: String,
    spokenValue: String,
) {
    OutlinedCard(Modifier.semantics(mergeDescendants = true) {}) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(18.dp), tint = tint)
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            }
            Readout(value, Modifier.clearAndSetSemantics { contentDescription = spokenValue })
        }
    }
}

@Composable
private fun WentWellStep(
    feedback: LanguageCallFeedback?,
    language: String,
    met: List<String>,
) {
    StepTitle(stringResource(R.string.conversation_went_well))
    if (met.isNotEmpty()) {
        Column {
            met.forEachIndexed { index, label ->
                if (index > 0) HorizontalDivider()
                ChecklistRow(inLanguage(label, language), done = true)
            }
        }
    }
    val phrases = feedback?.wentWell.orEmpty()
    if (phrases.isNotEmpty()) {
        Column {
            SectionTitle(stringResource(R.string.conversation_said_well))
            phrases.forEachIndexed { index, phrase ->
                if (index > 0) HorizontalDivider()
                Text(inLanguage("“$phrase”", language), Modifier.padding(vertical = 10.dp), style = MaterialTheme.typography.titleSmall)
            }
        }
    }
}

@Composable
private fun ImproveStep(
    feedback: LanguageCallFeedback?,
    language: String,
    missed: List<String>,
    speech: SpeechPlayer,
) {
    StepTitle(stringResource(R.string.conversation_to_improve))
    feedback?.improve?.let { improve ->
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DiffLine(stringResource(R.string.conversation_you_said_label), "− ", improve.said, language, better = false)
            DiffLine(stringResource(R.string.conversation_better), "+ ", improve.better, language, better = true)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                Text(
                    improve.why,
                    Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                SpeakButton(speech, language, improve.better, personal = true)
            }
        }
    }
    if (missed.isNotEmpty()) {
        Column {
            SectionTitle(stringResource(R.string.conversation_still_to_get_across))
            missed.forEachIndexed { index, label ->
                if (index > 0) HorizontalDivider()
                ChecklistRow(inLanguage(label, language), done = false)
            }
        }
    }
    val pronunciation = feedback?.pronunciation.orEmpty()
    if (pronunciation.isNotEmpty()) {
        Column {
            SectionTitle(stringResource(R.string.conversation_words_to_practice))
            pronunciation.forEachIndexed { index, item ->
                if (index > 0) HorizontalDivider()
                Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                            Text(inLanguage(item.word, language), style = MaterialTheme.typography.titleSmall)
                            Text(
                                item.respelling,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                            )
                        }
                        RichInlineText(
                            item.tip,
                            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                        )
                    }
                    SpeakButton(speech, language, item.word)
                }
            }
        }
    }
}

/** A line of main's `DiffLines`: what was said, struck out in pink, and the better way in blue. */
@Composable
private fun DiffLine(
    label: String,
    sign: String,
    text: String,
    language: String,
    better: Boolean,
) {
    val spoken = "$label: $text"
    Surface(
        Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = spoken },
        shape = MaterialTheme.shapes.small,
        color = if (better) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.errorContainer,
        contentColor = if (better) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onErrorContainer,
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
            Text(sign, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace))
            Text(inLanguage(text, language), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun SpeakButton(
    speech: SpeechPlayer,
    language: String,
    text: String,
    personal: Boolean = false,
) {
    val audio = rememberSpokenAudio(speech, language)
    ListenButton(audio, listOf(SpokenText(text, personal = personal)), stringResource(R.string.conversation_listen))
}

@Composable
private fun StepTitle(text: String) {
    Text(text, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
}

@Composable
private fun Note(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

private const val MAX_STARS = 3
