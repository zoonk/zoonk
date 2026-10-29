package com.zoonk.android.feature.mock.runner

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.feature.mock.rememberNow
import com.zoonk.android.feature.questions.formatClock
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.MockExamCurrent
import com.zoonk.api.models.MockExamSectionsInner
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** Main's `MockRunnerView`: one question at a time with no feedback, Flag and Next at the thumb, the answer sheet a tap away. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun MockRunnerView(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    current: MockExamCurrent,
    audio: MockAudio,
    onClose: () -> Unit,
) {
    val question = run.question ?: return
    var confirming by rememberSaveable { mutableStateOf(false) }
    var sheetOpen by rememberSaveable { mutableStateOf(false) }
    var sheetBeside by remember { mutableStateOf(false) }
    val handIn = { confirming = true }

    TaskScaffold(
        onClose = onClose,
        modifier = Modifier.onPreviewKeyEvent { event -> event.type == KeyEventType.KeyDown && runnerKey(event.key, viewModel, run) },
        title = { if (!sheetBeside) SectionClock(current.deadline) },
        actions = {
            if (!sheetBeside) {
                TextButton(onClick = { sheetOpen = true }) { Text(stringResource(R.string.mock_sheet)) }
            }
        },
        bottomBar = { RunnerActions(viewModel, run, handIn) },
    ) { padding ->
        PageWithSupportingPane(
            modifier = Modifier.padding(padding),
            supportingPane = {
                val label = stringResource(R.string.mock_answer_sheet)
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(STEP_PADDING)
                        .semantics { paneTitle = label },
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    Text(mockTitle(run.view.number), style = MaterialTheme.typography.titleSmall)
                    SectionClock(current.deadline, large = true)
                    AnswerSheet(run, onPick = viewModel::go)
                    OutlinedButton(
                        onClick = handIn,
                        enabled = !run.pending,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(stringResource(R.string.mock_hand_in)) }
                }
            },
        ) { beside ->
            LaunchedEffect(beside) { sheetBeside = beside }
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                Column(Modifier.widthIn(max = COLUMN_WIDTH).fillMaxWidth().verticalScroll(rememberScrollState())) {
                    RunnerProgress(run, onQuestionTimeUp = viewModel::timeOutQuestion)
                    Column(Modifier.padding(STEP_PADDING), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        key(question.question.set?.id) { MockRecording(viewModel, run, question, audio) }
                        key(question.itemId) { MockQuestionCard(viewModel, run, question) }
                        if (!beside) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                QuestionMap(run, onPick = viewModel::go)
                                SheetLegend()
                                MovesNote(run.moves)
                            }
                        }
                    }
                }
            }
        }
    }

    if (sheetOpen && !sheetBeside) {
        ModalBottomSheet(
            onDismissRequest = { sheetOpen = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.mock_answer_sheet), style = MaterialTheme.typography.titleLarge)
                    Text(
                        sheetCounts(run.counts),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
                AnswerSheet(
                    run,
                    onPick = {
                        viewModel.go(it)
                        sheetOpen = false
                    },
                    withMoves = true,
                )
                OutlinedButton(
                    onClick = {
                        sheetOpen = false
                        handIn()
                    },
                    enabled = !run.pending,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                ) { Text(stringResource(R.string.mock_hand_in)) }
            }
        }
    }

    if (confirming) HandInDialog(run, onDismiss = { confirming = false }, onHandIn = { viewModel.submitSection() })
}

/** Keys as on main: the arrows move, Enter goes on, F flags. Number keys pick in the options themselves. */
private fun runnerKey(
    key: Key,
    viewModel: MockRunnerViewModel,
    run: MockRun,
): Boolean {
    val last = run.position >= run.questions.lastIndex
    return when (key) {
        Key.DirectionRight -> {
            if (run.moves.canAdvance) viewModel.go(run.position + 1)
            true
        }

        Key.DirectionLeft -> {
            viewModel.go(run.position - 1)
            true
        }

        Key.Enter -> {
            if (last || run.pending || !run.moves.canAdvance) return false
            viewModel.go(run.position + 1)
            true
        }

        Key.F -> {
            viewModel.toggleFlag()
            true
        }

        else -> {
            false
        }
    }
}

@Composable
private fun RunnerProgress(
    run: MockRun,
    onQuestionTimeUp: () -> Unit,
) {
    val question = run.question ?: return
    val counts = run.counts
    val place = sectionPlace(run.position, run.questions)
    val spokenPlace = questionPlace(run, question)

    Column(Modifier.fillMaxWidth()) {
        LinearProgressIndicator(
            progress = { if (counts.total > 0) counts.answered / counts.total.toFloat() else 0f },
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.tertiary,
            trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
            drawStopIndicator = {},
        )
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).semantics(mergeDescendants = true) {
                contentDescription =
                    spokenPlace
            },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val meta = MaterialTheme.typography.labelMedium.withTabularFigures()
            Text(
                listOfNotNull(mockTitle(run.view.number), question.question.area).joinToString(" · "),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = meta,
            )
            run.moves.itemSeconds?.let { key(question.itemId) { ItemCountdown(it, onTimeUp = onQuestionTimeUp) } }
            Text(
                place?.let { stringResource(R.string.mock_place, it.number, it.total) } ?: stringResource(R.string.mock_written_part),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = meta,
            )
        }
    }
}

/** "Question 12 of 45 · Mathematics", for TalkBack. */
@Composable
internal fun questionPlace(
    run: MockRun,
    question: MockQuestion,
): String {
    val area = question.question.area
    if (question.essay) {
        return area?.let { stringResource(R.string.mock_written_part_area, it) }
            ?: stringResource(R.string.mock_written_part)
    }
    val total = run.view.questions.toInt()
    return area?.let { stringResource(R.string.mock_question_place_area, question.number, total, it) }
        ?: stringResource(R.string.mock_question_place, question.number, total)
}

/** A timer isn't a live region, so it never reads every second. */
@Composable
internal fun SectionClock(
    deadline: Instant,
    large: Boolean = false,
) {
    val now by rememberNow(1.seconds)
    val remaining = (deadline - now).inWholeMilliseconds.coerceAtLeast(0)
    val label = stringResource(R.string.mock_time_left_label)
    val text = formatClock(remaining)

    Column(
        Modifier.clearAndSetSemantics { contentDescription = "$label $text" },
        horizontalAlignment = if (large) Alignment.Start else Alignment.CenterHorizontally,
    ) {
        Text(
            text,
            style = (if (large) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleLarge).withTabularFigures(),
        )
        Text(
            stringResource(R.string.mock_time_left_caption),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun RunnerActions(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    onHandIn: () -> Unit,
) {
    val question = run.question
    val flagged = question != null && run.drafts[question.itemId]?.flagged == true
    val last = run.position >= run.questions.lastIndex
    val handingIn = run.busy == MockStep.Submit

    MockActionBar {
        MockStepStatus(viewModel, run)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val flagState = stringResource(if (flagged) R.string.mock_cell_flagged else R.string.mock_flag)
            OutlinedButton(
                onClick = viewModel::toggleFlag,
                modifier = Modifier.heightIn(min = 48.dp).semantics { stateDescription = flagState },
                border =
                    if (flagged) {
                        BorderStroke(
                            1.dp,
                            MaterialTheme.zoonk.warning,
                        )
                    } else {
                        ButtonDefaults.outlinedButtonBorder(enabled = true)
                    },
                colors =
                    ButtonDefaults.outlinedButtonColors(
                        contentColor = if (flagged) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurface,
                    ),
            ) {
                Icon(
                    painterResource(if (flagged) R.drawable.ic_flag_filled else R.drawable.ic_flag),
                    contentDescription = null,
                    modifier = Modifier.size(ButtonDefaults.IconSize),
                )
                Text(stringResource(R.string.mock_flag), Modifier.padding(start = ButtonDefaults.IconSpacing))
            }
            MockMainButtonIn(
                text =
                    when {
                        handingIn -> stringResource(R.string.mock_handing_in)
                        !last -> stringResource(R.string.mock_next)
                        run.isLastSection -> stringResource(R.string.mock_hand_in_mock)
                        else -> stringResource(R.string.mock_hand_in_section)
                    },
                busy = handingIn,
                enabled = !run.pending && run.moves.canAdvance,
                onClick = { if (last) onHandIn() else viewModel.go(run.position + 1) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MockMainButtonIn(
    text: String,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Button(onClick = onClick, enabled = enabled && !busy, modifier = modifier.heightIn(min = 48.dp)) { Text(text) }
}

/** Main's `MockQuestionMap`: the nine questions around the one on screen, to jump between. */
@Composable
private fun QuestionMap(
    run: MockRun,
    onPick: (Int) -> Unit,
) {
    if (run.questions.size <= 1) return
    val start = run.position / MAP_ROW * MAP_ROW
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        run.questions.drop(start).take(MAP_ROW).forEachIndexed { offset, question ->
            QuestionCell(run, start + offset, question, onPick, Modifier.weight(1f), compact = true)
        }
        repeat(
            MAP_ROW -
                run.questions
                    .drop(start)
                    .take(MAP_ROW)
                    .size,
        ) { Box(Modifier.weight(1f)) }
    }
}

@Composable
internal fun SheetLegend() {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).flaggedEdge())
        Text(
            stringResource(R.string.mock_legend),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
internal fun MovesNote(moves: SectionMoves) {
    val line =
        when {
            moves.reviewing && moves.changesLeft == null -> stringResource(R.string.mock_moves_review_any)
            moves.reviewing && moves.changesLeft == 0 -> stringResource(R.string.mock_moves_review_none)
            moves.reviewing -> pluralStringResource(R.plurals.mock_moves_review_changes, moves.changesLeft!!, moves.changesLeft)
            moves.forwardOnly && moves.mustAnswer -> stringResource(R.string.mock_moves_forward_must)
            moves.forwardOnly -> stringResource(R.string.mock_moves_forward)
            moves.mustAnswer -> stringResource(R.string.mock_moves_must)
            else -> return
        }
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            painterResource(if (moves.reviewing) R.drawable.ic_replay else R.drawable.ic_skip_next),
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun HandInDialog(
    run: MockRun,
    onDismiss: () -> Unit,
    onHandIn: () -> Unit,
) {
    val counts = run.counts
    val questions =
        when {
            counts.blank > 0 && counts.flagged > 0 -> {
                stringResource(
                    R.string.mock_left_blank_and_flagged,
                    pluralStringResource(R.plurals.mock_left_blank, counts.blank, counts.blank),
                    pluralStringResource(R.plurals.mock_left_flagged, counts.flagged, counts.flagged),
                )
            }

            counts.blank > 0 -> {
                pluralStringResource(R.plurals.mock_left_blank_only, counts.blank, counts.blank)
            }

            counts.flagged > 0 -> {
                pluralStringResource(R.plurals.mock_left_flagged_only, counts.flagged, counts.flagged)
            }

            counts.total > counts.essays -> {
                stringResource(R.string.mock_every_answered)
            }

            else -> {
                ""
            }
        }
    val essays =
        when {
            counts.blankEssays == 1 -> stringResource(R.string.mock_essay_blank)
            counts.blankEssays > 1 -> pluralStringResource(R.plurals.mock_essays_blank, counts.blankEssays, counts.blankEssays)
            else -> ""
        }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(if (run.isLastSection) R.string.mock_hand_in_mock_title else R.string.mock_hand_in_section_title)) },
        text = {
            Text(
                listOf(questions, essays, stringResource(R.string.mock_hand_in_final)).filter(String::isNotEmpty).joinToString(" "),
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onDismiss()
                    onHandIn()
                },
            ) { Text(stringResource(R.string.mock_hand_in)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.mock_keep_answering)) } },
    )
}

/** Every question of the section, its notes and its sections: main's answer sheet. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AnswerSheet(
    run: MockRun,
    onPick: (Int) -> Unit,
    withMoves: Boolean = false,
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val label = stringResource(R.string.mock_questions)
            FlowRow(
                Modifier.semantics { contentDescription = label },
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                run.questions.forEachIndexed { index, question ->
                    QuestionCell(run, index, question, onPick, Modifier.size(48.dp), compact = false)
                }
            }
            SheetLegend()
            if (withMoves) MovesNote(run.moves)
        }
        SheetNotes(run)
        if (run.view.sections.size > 1) SheetSections(run)
    }
}

@Composable
private fun SheetNotes(run: MockRun) {
    val tools = run.currentSection?.tools
    val examQuestions = run.view.examQuestions
    val reused = run.view.reusedQuestions.toInt()
    val questions = run.view.questions.toInt()
    val lines =
        listOfNotNull(
            tools?.let { R.drawable.ic_edit_square to it },
            examQuestions?.takeIf { it > questions }?.let {
                null to
                    pluralStringResource(R.plurals.mock_short, questions, questions, it.toInt())
            },
            reused.takeIf { it > 0 }?.let { R.drawable.ic_history to pluralStringResource(R.plurals.mock_reused, it, it) },
        )
    if (lines.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        lines.forEach { (icon, text) ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                icon?.let {
                    Icon(
                        painterResource(it),
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** The mock's sections with the one running, as on the answer sheet and the break. */
@Composable
internal fun SheetSections(run: MockRun) {
    val counts = run.counts
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(stringResource(R.string.mock_sections), style = MaterialTheme.typography.titleSmall)
        run.view.sections.forEachIndexed { index, section ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).semantics(mergeDescendants = true) {},
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                StatusMark(
                    when (section.status) {
                        MockExamSectionsInner.Status.CURRENT -> MarkStatus.Next
                        MockExamSectionsInner.Status.DONE -> MarkStatus.Done
                        MockExamSectionsInner.Status.UPCOMING -> MarkStatus.Todo
                    },
                )
                Text(
                    section.name ?: stringResource(R.string.mock_section_number, section.index.toInt() + 1),
                    Modifier.weight(1f),
                    color =
                        if (section.status ==
                            MockExamSectionsInner.Status.CURRENT
                        ) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    if (section.status == MockExamSectionsInner.Status.DONE) {
                        stringResource(R.string.mock_handed_in)
                    } else {
                        stringResource(
                            R.string.mock_section_answered,
                            if (section.status == MockExamSectionsInner.Status.CURRENT) counts.answered else 0,
                            (section.questions + section.essays).toInt(),
                        )
                    },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

@Composable
private fun sheetCounts(counts: SectionCounts): String =
    stringResource(
        R.string.mock_row_detail,
        pluralStringResource(R.plurals.mock_answered_count, counts.answered, counts.answered),
        pluralStringResource(R.plurals.mock_flagged_count, counts.flagged, counts.flagged),
    )

private const val MAP_ROW = 9
