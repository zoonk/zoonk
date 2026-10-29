package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.recode
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.ExamSpeakingFeedback
import com.zoonk.api.models.ExamSpeakingFeedbackCriteriaInner
import com.zoonk.api.models.ExamSpeakingTask
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationResultFeedback
import com.zoonk.api.models.LanguageSpeakingMockFeedback
import com.zoonk.api.models.SpeakingCriterion
import kotlinx.serialization.Serializable

/** What a result's last step offers besides Continue. */
internal class ResultActions(
    val onContinue: () -> Unit,
    val onClose: () -> Unit,
    /** Null where there's no other try to start (a mock's own task). */
    val onTryAgain: (() -> Unit)?,
    val nextTask: (() -> Unit)?,
)

/** A result's steps one at a time, with what the last one offers under it. */
@Composable
private fun ResultSteps(
    title: String,
    steps: List<@Composable ColumnScope.() -> Unit>,
    actions: ResultActions,
    nextLabel: String?,
    dayMoment: @Composable () -> Unit,
    options: @Composable ColumnScope.() -> Unit,
) {
    var index by rememberSaveable { mutableIntStateOf(0) }
    val shown = index.coerceIn(0, steps.lastIndex)
    CallFrame(
        title = title,
        onClose = actions.onClose,
        bottomBar = {
            StepPagerActions(steps.size, shown, onIndexChange = { index = it }) {
                Button(onClick = actions.nextTask ?: actions.onContinue) { Text(nextLabel ?: stringResource(R.string.steps_continue)) }
            }
        },
    ) {
        item(key = "step-$shown") {
            Column(Modifier.callItem(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                steps[shown]()
                if (shown == 0) dayMoment()
                if (shown == steps.lastIndex) options()
            }
        }
    }
}

/** Main's `ExamSpeakingResult`: the estimate per official criterion, then what to work on first. */
@Composable
internal fun ExamSpeakingResult(
    conversation: LanguageConversation,
    task: ExamSpeakingTask,
    actions: ResultActions,
    dayMoment: @Composable () -> Unit = {},
) {
    val feedback = (conversation.result?.feedback as? LanguageConversationResultFeedback.ExamspeakingWrapper)?.value
    val language = conversation.targetLanguage
    val graded =
        feedback
            ?.let { found ->
                task.criteria.mapNotNull { c ->
                    found.criteria.firstOrNull { it.criterion == c.key }?.let {
                        c to
                            it
                    }
                }
            }.orEmpty()
    val focus = graded.firstOrNull { it.first.key == feedback?.focus }
    val steps =
        buildList<@Composable ColumnScope.() -> Unit> {
            if (feedback != null && graded.isNotEmpty()) {
                add { CriteriaStep(conversation, task, feedback) }
                focus?.let { (criterion, grade) ->
                    add { FocusStep(criterionGloss(criterion.key, criterion.name), criterion.name, grade.evidence, grade.tip, language) }
                }
            } else {
                add { NoGradeStep(R.string.conversation_no_estimate_title, R.string.conversation_no_estimate) }
            }
        }
    val next = task.nextTask
    ResultSteps(
        title = examTaskTitle(task),
        steps = steps,
        actions = actions,
        nextLabel =
            if (next != null &&
                actions.nextTask != null
            ) {
                stringResource(R.string.conversation_go_to_task, (task.number + 1).toString())
            } else {
                null
            },
        dayMoment = dayMoment,
    ) {
        actions.onTryAgain?.let { TextButton(onClick = it) { Text(stringResource(R.string.conversation_try_new_card)) } }
        if (graded.isNotEmpty()) {
            EveryCriterion(
                graded.map { (criterion, grade) ->
                    CriterionDetail(
                        title =
                            stringResource(
                                R.string.conversation_criterion_line,
                                criterionGloss(criterion.key, criterion.name),
                                bandText(grade.bandLow, grade.bandHigh, criterion),
                                standingText(levelStanding(grade.bandLow, grade.bandHigh, criterion.levelMark), task.level.value),
                            ),
                        official = criterion.name,
                        evidence = grade.evidence,
                        tip = grade.tip,
                    )
                },
                language,
            )
        }
    }
}

@Composable
private fun CriteriaStep(
    conversation: LanguageConversation,
    task: ExamSpeakingTask,
    feedback: ExamSpeakingFeedback,
) {
    val language = conversation.targetLanguage
    val bands = task.criteria.map { it.levelBand }.toSet()
    val numbered = task.criteria.all { it.display == SpeakingCriterion.Display.BAND }
    val levelBand = bands.singleOrNull()
    val aboutSound = feedback.heard && task.criteria.any { it.sound }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(inLanguage(task.task.name, language), Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        if (numbered && levelBand != null) Note(stringResource(R.string.conversation_level_line, levelBand.toString(), task.level.value))
        if (!feedback.heard) Note(stringResource(R.string.conversation_typed_note))
        if (feedback.brief) Note(stringResource(R.string.conversation_brief_note))
    }
    Column {
        task.criteria.forEachIndexed { index, criterion ->
            if (index > 0) HorizontalDivider()
            val grade = feedback.criteria.firstOrNull { it.criterion == criterion.key }
            CriterionRow(criterion, grade, focus = criterion.key == feedback.focus, level = task.level.value, language = language)
        }
    }
    Note(stringResource(if (aboutSound) R.string.conversation_estimate_sound else R.string.conversation_estimate))
}

@Composable
private fun CriterionRow(
    criterion: SpeakingCriterion,
    grade: ExamSpeakingFeedbackCriteriaInner?,
    focus: Boolean,
    level: String,
    language: String,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp).semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(criterionGloss(criterion.key, criterion.name), style = MaterialTheme.typography.titleSmall)
            Text(
                inLanguage(criterion.name, language),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (grade == null) {
            Text(
                stringResource(R.string.conversation_not_rated),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            val standing = levelStanding(grade.bandLow, grade.bandHigh, criterion.levelMark)
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    bandText(grade.bandLow, grade.bandHigh, criterion),
                    style = MaterialTheme.typography.titleSmall.copy(fontFamily = FontFamily.Monospace),
                )
                Text(
                    standingText(standing, level),
                    color =
                        if (standing ==
                            LevelStanding.At
                        ) {
                            MaterialTheme.colorScheme.tertiary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    style = MaterialTheme.typography.bodySmall,
                )
                if (focus) LabelChip(stringResource(R.string.conversation_focus))
            }
        }
    }
}

@Composable
private fun FocusStep(
    title: String,
    official: String?,
    evidence: String,
    tip: String,
    language: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            stringResource(R.string.conversation_work_on_first),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        official?.let {
            Text(inLanguage(it, language), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
        Text(evidence, style = MaterialTheme.typography.bodyLarge)
    }
    CallNote(tip, R.drawable.ic_lightbulb)
}

@Composable
private fun NoGradeStep(
    title: Int,
    text: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(stringResource(title), Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        Note(stringResource(text))
    }
}

internal class CriterionDetail(
    val title: String,
    val official: String?,
    val evidence: String,
    val tip: String,
)

/** Main's "See every criterion" drawer, as a bottom sheet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EveryCriterion(
    details: List<CriterionDetail>,
    language: String,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }) { Text(stringResource(R.string.conversation_every_criterion)) }
    if (!open) return
    ModalBottomSheet(onDismissRequest = { open = false }) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                stringResource(R.string.conversation_by_criterion),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
            details.forEach { detail ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(detail.title, style = MaterialTheme.typography.titleSmall)
                    detail.official?.let {
                        Text(
                            inLanguage(it, language),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Text(detail.evidence, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    Text(detail.tip, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

/** Both mocks' feedback, which differ only in their exam's criteria. */
@Serializable
private data class MockFeedback(
    val exam: String,
    val overall: MockBand,
    val focus: String,
    val criteria: List<MockCriterion>,
)

@Serializable
private data class MockBand(
    val bandLow: Double,
    val bandHigh: Double,
)

@Serializable
private data class MockCriterion(
    val criterion: String,
    val bandLow: Double,
    val bandHigh: Double,
    val evidence: String,
    val tip: String,
)

/** Core's `SPEAKING_MOCK_CRITERIA`: each mock's criteria in its exam's order. */
private val MOCK_CRITERIA =
    mapOf(
        "ielts" to listOf("fluencyCoherence", "lexicalResource", "grammar", "pronunciation"),
        "toefl" to listOf("repetition", "elaboration", "grammar", "vocabulary", "delivery"),
    )

private val MOCK_CRITERION_NAMES =
    mapOf(
        "delivery" to R.string.conversation_mock_delivery,
        "elaboration" to R.string.conversation_mock_elaboration,
        "fluencyCoherence" to R.string.conversation_mock_fluency_coherence,
        "grammar" to R.string.conversation_criterion_grammar,
        "lexicalResource" to R.string.conversation_criterion_vocabulary,
        "pronunciation" to R.string.conversation_criterion_pronunciation,
        "repetition" to R.string.conversation_mock_repetition,
        "vocabulary" to R.string.conversation_criterion_vocabulary,
    )

@Composable
private fun mockCriterionName(key: String) = MOCK_CRITERION_NAMES[key]?.let { stringResource(it) } ?: key

@Composable
private fun bandRange(
    low: Double,
    high: Double,
): String {
    val locale = currentLocale()

    fun band(value: Double) = String.format(locale, "%.1f", value)
    return if (low == high) band(low) else "${band(low)}–${band(high)}"
}

/** Main's `SpeakingMockResult`: the overall band, the band per criterion, then what to work on first. */
@Composable
internal fun SpeakingMockResult(
    conversation: LanguageConversation,
    actions: ResultActions,
    dayMoment: @Composable () -> Unit = {},
) {
    val feedback =
        when (val mock = (conversation.result?.feedback as? LanguageConversationResultFeedback.SpeakingmockWrapper)?.value) {
            is LanguageSpeakingMockFeedback.IeltsWrapper -> mock.value.recode<_, MockFeedback>()
            is LanguageSpeakingMockFeedback.ToeflWrapper -> mock.value.recode<_, MockFeedback>()
            null -> null
        }
    val focus = feedback?.criteria?.firstOrNull { it.criterion == feedback.focus }
    val title = conversationTitle(conversation)
    val steps =
        buildList<@Composable ColumnScope.() -> Unit> {
            if (feedback == null) {
                add { NoGradeStep(R.string.conversation_no_score_title, R.string.conversation_no_score) }
                return@buildList
            }
            add {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Readout(bandRange(feedback.overall.bandLow, feedback.overall.bandHigh), style = MaterialTheme.typography.displaySmall)
                    Note(
                        stringResource(
                            if (feedback.exam ==
                                "toefl"
                            ) {
                                R.string.conversation_mock_band_toefl
                            } else {
                                R.string.conversation_mock_band_ielts
                            },
                        ),
                    )
                }
                Note(stringResource(R.string.conversation_mock_estimate))
            }
            if (feedback.criteria.isNotEmpty()) {
                add {
                    val rows =
                        MOCK_CRITERIA[feedback.exam].orEmpty().map { key ->
                            key to
                                feedback.criteria.firstOrNull { it.criterion == key }
                        }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            stringResource(R.string.conversation_by_criterion),
                            Modifier.semantics { heading() },
                            style = MaterialTheme.typography.headlineMedium,
                        )
                        if (rows.any { it.second == null }) Note(stringResource(R.string.conversation_typed_note))
                    }
                    Column {
                        rows.forEachIndexed { index, (key, graded) ->
                            if (index > 0) HorizontalDivider()
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 10.dp).semantics(mergeDescendants = true) {},
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Row(
                                    Modifier.weight(1f),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(mockCriterionName(key), style = MaterialTheme.typography.titleSmall)
                                    if (key == feedback.focus) LabelChip(stringResource(R.string.conversation_focus))
                                }
                                Text(
                                    graded?.let { bandRange(it.bandLow, it.bandHigh) } ?: stringResource(R.string.conversation_not_rated),
                                    color =
                                        if (graded ==
                                            null
                                        ) {
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        } else {
                                            MaterialTheme.colorScheme.onSurface
                                        },
                                    style =
                                        if (graded ==
                                            null
                                        ) {
                                            MaterialTheme.typography.bodyMedium
                                        } else {
                                            MaterialTheme.typography.titleSmall.copy(fontFamily = FontFamily.Monospace)
                                        },
                                )
                            }
                        }
                    }
                }
            }
            focus?.let { add { FocusStep(mockCriterionName(it.criterion), null, it.evidence, it.tip, conversation.targetLanguage) } }
        }
    ResultSteps(title = title, steps = steps, actions = actions, nextLabel = null, dayMoment = dayMoment) {
        actions.onTryAgain?.let { TextButton(onClick = it) { Text(stringResource(R.string.conversation_try_another_mock)) } }
        if (feedback != null && feedback.criteria.isNotEmpty()) {
            EveryCriterion(
                feedback.criteria.map { CriterionDetail(mockCriterionName(it.criterion), null, it.evidence, it.tip) },
                conversation.targetLanguage,
            )
        }
    }
}

@Composable
private fun Note(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}
