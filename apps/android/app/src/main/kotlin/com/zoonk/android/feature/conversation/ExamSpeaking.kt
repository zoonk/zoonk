package com.zoonk.android.feature.conversation

import android.icu.text.ListFormatter
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.ui.components.formatClock
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.RichTable
import com.zoonk.android.ui.richtext.SpokenText
import com.zoonk.android.ui.richtext.TableAlign
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamSpeakingTask
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.SpeakingCard
import com.zoonk.api.models.SpeakingCriterion
import com.zoonk.api.models.SpeakingTask
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** The exam's way of saying how long a task lasts; a range keeps its own words. */
@Composable
fun taskMinutes(
    min: Double,
    max: Double,
): String =
    if (min == max) {
        formatDuration((max * 60).roundToLong(), currentLocale())
    } else {
        stringResource(R.string.conversation_minutes_range, formatNumber(min, currentLocale()), formatNumber(max, currentLocale()))
    }

/** Always marked as the AI. */
@Composable
fun taskRoleLabel(partner: Boolean) =
    stringResource(if (partner) R.string.conversation_role_partner_label else R.string.conversation_role_examiner_label)

@Composable
internal fun taskRoleNoun(partner: Boolean) =
    stringResource(if (partner) R.string.conversation_role_partner else R.string.conversation_role_examiner)

/** Main's `useCriterionGloss`: the criterion in the learner's words, its official name otherwise. */
@Composable
fun criterionGloss(
    key: String,
    name: String,
): String = CRITERION_GLOSSES[key]?.let { stringResource(it) } ?: name

private val CRITERION_GLOSSES =
    mapOf(
        "accuracy" to R.string.conversation_criterion_accuracy,
        "coherence" to R.string.conversation_criterion_coherence,
        "discourse" to R.string.conversation_criterion_discourse,
        "fluency" to R.string.conversation_criterion_fluency,
        "global" to R.string.conversation_criterion_overall,
        "grammar" to R.string.conversation_criterion_grammar,
        "grammarVocabulary" to R.string.conversation_criterion_grammar_vocabulary,
        "holistic" to R.string.conversation_criterion_overall,
        "interaction" to R.string.conversation_criterion_interaction,
        "interviewer" to R.string.conversation_criterion_interviewer,
        "language" to R.string.conversation_criterion_language,
        "languageUse" to R.string.conversation_criterion_language_use,
        "lexis" to R.string.conversation_criterion_vocabulary,
        "pronunciation" to R.string.conversation_criterion_pronunciation,
        "questions" to R.string.conversation_criterion_questions,
        "range" to R.string.conversation_criterion_range,
        "taskCompletion" to R.string.conversation_criterion_task,
        "vocabulary" to R.string.conversation_criterion_vocabulary,
    )

/** "A, B and C" in the reader's language. */
fun spokenList(
    items: List<String>,
    locale: Locale,
): String = ListFormatter.getInstance(locale).format(items)

@Composable
fun examTaskTitle(task: ExamSpeakingTask) =
    stringResource(R.string.conversation_exam_task_title, task.title, task.number.toString(), task.taskCount.toString())

enum class LevelStanding { At, Near, Below }

/** Core's `getLevelStanding`: the estimate's middle at the level's mark is at it, its top alone near it. */
fun levelStanding(
    bandLow: Double,
    bandHigh: Double,
    levelMark: Double,
): LevelStanding =
    when {
        (bandLow + bandHigh) / 2 >= levelMark -> LevelStanding.At
        bandHigh >= levelMark -> LevelStanding.Near
        else -> LevelStanding.Below
    }

@Composable
internal fun standingText(
    standing: LevelStanding,
    level: String,
) = stringResource(
    when (standing) {
        LevelStanding.At -> R.string.conversation_at_level
        LevelStanding.Near -> R.string.conversation_near_level
        LevelStanding.Below -> R.string.conversation_below_level
    },
    level,
)

/** Main's `useBandText`: letters for Goethe, points where the exam counts them, else the band of its scale. */
@Composable
internal fun bandText(
    bandLow: Double,
    bandHigh: Double,
    criterion: SpeakingCriterion,
): String {
    val locale = currentLocale()

    fun number(value: Double) = formatNumber((value * 100).roundToInt() / 100.0, locale)

    fun span(
        low: String,
        high: String,
    ) = if (low == high) low else "$low–$high"

    val points = criterion.points
    return when {
        criterion.display == SpeakingCriterion.Display.LETTER -> {
            span(LETTERS.getOrElse(bandHigh.roundToInt()) { "" }, LETTERS.getOrElse(bandLow.roundToInt()) { "" })
        }

        criterion.display == SpeakingCriterion.Display.POINTS && points != null -> {
            fun at(band: Double) = points.getOrElse(band.roundToInt()) { 0.0 }
            stringResource(
                R.string.conversation_band_points,
                span(number(at(bandLow)), number(at(bandHigh))),
                number(points.lastOrNull() ?: 0.0),
            )
        }

        else -> {
            stringResource(R.string.conversation_band, span(number(bandLow), number(bandHigh)), number(criterion.maxBand.toDouble()))
        }
    }
}

/** Goethe's letters by band: 0 is E, 4 is A. */
private val LETTERS = listOf("E", "D", "C", "B", "A")

/** The card a task is done from, in the exam's language; [compact] keeps it short beside a call. */
@Composable
internal fun SpeakingCardView(
    card: SpeakingCard,
    language: String,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val label = stringResource(R.string.conversation_your_card)
    OutlinedCard(modifier.fillMaxWidth().semantics { contentDescription = label }) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                card.instructions.forEach { Text(inLanguage(it, language), style = MaterialTheme.typography.titleSmall) }
            }
            card.photos.forEach { photo ->
                AsyncImage(
                    model = photo.url,
                    contentDescription = photo.alt,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .then(if (compact) Modifier.heightIn(max = 160.dp) else Modifier),
                    contentScale = ContentScale.Crop,
                )
            }
            card.text?.let { text ->
                val scroll = rememberScrollState()
                Column(
                    Modifier
                        .then(if (compact) Modifier.heightIn(max = 220.dp).verticalScroll(scroll).focusable() else Modifier),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(inLanguage(text.title, language), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
                    text.body.split(Regex("\n\\s*\n")).forEach { paragraph ->
                        Text(inLanguage(paragraph, language), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            card.table?.let { table ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(inLanguage(table.title, language), style = MaterialTheme.typography.titleSmall)
                    RichTable(
                        align = table.columns.map { TableAlign.Start },
                        header = table.columns.map { SpokenText(inLanguage(it, language)) },
                        rows = table.rows.map { row -> row.map { SpokenText(inLanguage(it, language)) } },
                    )
                }
            }
            if (card.prompts.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    card.prompts.forEach { prompt ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("•", style = MaterialTheme.typography.bodyMedium)
                            Text(inLanguage(prompt, language), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Main's `ExamTaskIntro`: the task, its card (beside it where there's room), who stands in for the
 * examiner, and the preparation clock, kept on the device per card so it survives leaving.
 */
@Composable
internal fun ExamTaskIntro(
    conversation: LanguageConversation,
    task: ExamSpeakingTask,
    prepStartedAt: Long?,
    onStartPrep: () -> Unit,
    onClose: () -> Unit,
    actions: @Composable () -> Unit,
) {
    val locale = currentLocale()
    val partner = task.task.role == SpeakingTask.Role.PARTNER
    val name = conversation.character.name
    val criteria = spokenList(task.criteria.map { criterionGloss(it.key, it.name) }, locale)
    val card: @Composable () -> Unit = { SpeakingCardView(task.card, conversation.targetLanguage) }

    CallFrame(title = examTaskTitle(task), onClose = onClose, bottomBar = actions, aside = { card() }) { beside ->
        item(key = "header") {
            Column(Modifier.callItem(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    taskMinutes(task.task.minutes.min, task.task.minutes.max),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelLarge,
                )
                Text(
                    inLanguage(task.task.name, conversation.targetLanguage),
                    Modifier.semantics {
                        heading()
                    },
                    style = MaterialTheme.typography.headlineMedium,
                )
                Text(task.card.summary, style = MaterialTheme.typography.bodyLarge)
                Text(
                    stringResource(R.string.conversation_opens_and_card, name) + " " +
                        stringResource(R.string.conversation_rated_on, criteria),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        item(key = "character") { CharacterRow(name, taskRoleNoun(partner), Modifier.callItem()) }
        item(key = "stand-in") {
            val standIn =
                stringResource(if (partner) R.string.conversation_stand_in_partner else R.string.conversation_stand_in_examiner, name)
            CallNote(standIn + " " + stringResource(R.string.conversation_practice_estimate), R.drawable.ic_help, Modifier.callItem())
        }
        if (task.task.prepMinutes > 0) {
            item(key = "prep") { PrepClock(task, prepStartedAt, onStartPrep, Modifier.callItem()) }
        }
        if (!beside) item(key = "card") { Column(Modifier.callItem()) { card() } }
        item(key = "mic") { CallNote(stringResource(R.string.conversation_speak_answers), R.drawable.ic_mic, Modifier.callItem()) }
    }
}

@Composable
private fun PrepClock(
    task: ExamSpeakingTask,
    startedAt: Long?,
    onStart: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val prep = task.task.prepMinutes
    val shared = task.task.prepShared
    val line =
        if (shared != null) {
            stringResource(
                R.string.conversation_prep_shared,
                formatDuration((shared.minutes * 60).roundToLong(), locale),
                spokenList(shared.tasks.map { it.toString() }, locale),
                formatDuration((prep * 60).roundToLong(), locale),
            )
        } else {
            stringResource(R.string.conversation_prep, formatDuration((prep * 60).roundToLong(), locale))
        }

    Row(modifier, horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.conversation_preparation), style = MaterialTheme.typography.titleSmall)
            if (startedAt == null) {
                Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            } else {
                PrepTimeLeft(startedAt + (prep * MS_PER_MINUTE).roundToLong())
            }
        }
        if (startedAt == null) {
            OutlinedButton(onClick = onStart) { Text(stringResource(R.string.conversation_start_preparing)) }
        } else {
            TextButton(onClick = onStart) { Text(stringResource(R.string.conversation_prep_again)) }
        }
    }
}

@Composable
private fun PrepTimeLeft(deadline: Long) {
    var now by remember(deadline) { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(deadline) {
        while (now < deadline) {
            delay(TICK_MS)
            now = System.currentTimeMillis()
        }
    }
    val left = (deadline - now).coerceAtLeast(0)
    if (left == 0L) {
        Text(
            stringResource(R.string.conversation_prep_over),
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.bodyMedium,
        )
    } else {
        Text(formatClock(left), style = MaterialTheme.typography.headlineSmall.withTabularFigures())
    }
}

private const val MS_PER_MINUTE = 60_000.0
private const val TICK_MS = 500L
