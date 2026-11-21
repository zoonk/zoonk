package com.zoonk.android.feature.mock.runner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockQuestionPlace
import com.zoonk.android.feature.mock.mockSectionTitle
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.feature.mock.rememberNow
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatClock
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.android.ui.scaffold.BarNoteInPage
import com.zoonk.android.ui.scaffold.LocalBarNoteRoom
import com.zoonk.android.ui.scaffold.TaskAside
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.barNoteViewport
import com.zoonk.android.ui.scaffold.taskAsideBeside
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.MockExamCurrent
import com.zoonk.api.models.MockExamSectionsInner
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** Main's `MockRunnerView`: one question at a time with no feedback, Not sure and Next at the thumb, the answer sheet a tap away. */
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
    val handIn = { confirming = true }
    val focus = remember { FocusRequester() }
    val tip = rememberTooltipState(isPersistent = true)
    val tipSeen = rememberUnsureTipSeen()
    val scope = rememberCoroutineScope()
    val toggleUnsure: () -> Unit = {
        val turningOn = run.drafts[question.itemId]?.unsure != true
        viewModel.toggleUnsure()
        if (turningOn && tipSeen.markFirstTime()) scope.launch { tip.show() }
    }

    // Keys reach the focused field first, so the runner's shortcuts never take its typing; a new question takes them back.
    // The tip is about the question it was shown on.
    LaunchedEffect(question.itemId) {
        focus.requestFocus()
        tip.dismiss()
    }

    TaskScaffold(
        onClose = onClose,
        modifier = Modifier.focusRequester(focus).focusable().onKeyEvent { runnerKey(it, viewModel, run, toggleUnsure) },
        title = {
            if (taskAsideBeside()) {
                Text(mockTitle(run.view.number), Modifier.semantics { heading() }, maxLines = 1, overflow = TextOverflow.Ellipsis)
            } else {
                SectionClock(current.deadline)
            }
        },
        actions = {
            if (!taskAsideBeside()) {
                val label = stringResource(R.string.mock_answer_sheet)
                TextButton(onClick = { sheetOpen = true }, Modifier.semantics { contentDescription = label }) {
                    Text(stringResource(R.string.mock_sheet))
                }
            }
        },
        bottomBar = { RunnerActions(viewModel, run, tip, onUnsure = toggleUnsure, onHandIn = handIn) },
        note = mockStepNote(viewModel, run),
        aside =
            TaskAside(
                title = stringResource(R.string.mock_answer_sheet),
                footer = { SheetHandIn(run, onClick = handIn) },
            ) {
                SheetCounts(run)
                SectionClock(current.deadline, large = true)
                AnswerSheet(run, onPick = viewModel::go)
            },
    ) { padding ->
        val beside = taskAsideBeside()
        LaunchedEffect(beside) { if (beside) sheetOpen = false }

        // The whole pane scrolls, margins included, with the question held to a readable column.
        val noteRoom = LocalBarNoteRoom.current
        Box(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .barNoteViewport(noteRoom)
                .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(Modifier.taskColumn()) {
                RunnerProgress(run, titled = !beside, onQuestionTimeUp = viewModel::timeOutQuestion)
                Column(Modifier.padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    key(question.question.set?.id) { MockRecording(viewModel, run, question, audio) }
                    key(question.itemId) { MockQuestionCard(viewModel, run, question) }
                    if (!beside) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            QuestionMap(run, onPick = viewModel::go)
                            MovesNote(run.moves)
                        }
                    }
                    BarNoteInPage(noteRoom)
                }
            }
        }
    }

    if (sheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { sheetOpen = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            Column(Modifier.navigationBarsPadding()) {
                Column(
                    Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    AnswerSheetHeader(run)
                    AnswerSheet(
                        run,
                        onPick = {
                            viewModel.go(it)
                            sheetOpen = false
                        },
                        withMoves = true,
                    )
                }
                HorizontalDivider(Modifier.padding(top = 16.dp))
                Box(Modifier.padding(horizontal = 24.dp, vertical = 16.dp)) {
                    SheetHandIn(run) {
                        sheetOpen = false
                        handIn()
                    }
                }
            }
        }
    }

    if (confirming) HandInDialog(run, onDismiss = { confirming = false }, onHandIn = { viewModel.submitSection() })
}

@Composable
private fun SheetHandIn(
    run: MockRun,
    onClick: () -> Unit,
) {
    OutlinedButton(onClick = onClick, enabled = !run.pending, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
        Text(stringResource(R.string.mock_hand_in))
    }
}

@Composable
private fun AnswerSheetHeader(run: MockRun) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(stringResource(R.string.mock_answer_sheet), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
        SheetCounts(run)
    }
}

@Composable
private fun SheetCounts(run: MockRun) {
    Text(
        sheetCounts(run.counts),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
    )
}

/** Keys as on main, once however long they're held: the arrows move, Enter goes on, U marks not sure, numbers pick. */
private fun runnerKey(
    event: KeyEvent,
    viewModel: MockRunnerViewModel,
    run: MockRun,
    onUnsure: () -> Unit,
): Boolean {
    if (event.type != KeyEventType.KeyDown || event.nativeKeyEvent.repeatCount > 0) return false
    if (event.isCtrlPressed || event.isAltPressed || event.isMetaPressed) return false
    val digit = NUMBER_KEYS.indexOf(event.key).takeIf { it >= 0 } ?: NUMPAD_KEYS.indexOf(event.key)
    if (digit >= 0) return viewModel.pickOption(digit)
    val last = run.position >= run.questions.lastIndex
    return when (event.key) {
        Key.DirectionRight -> {
            if (run.moves.canAdvance) viewModel.go(run.position + 1)
            true
        }

        Key.DirectionLeft -> {
            viewModel.go(run.position - 1)
            true
        }

        Key.Enter, Key.NumPadEnter -> {
            if (event.isShiftPressed || last || run.pending || !run.moves.canAdvance) return false
            viewModel.go(run.position + 1)
            true
        }

        Key.U -> {
            onUnsure()
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
    titled: Boolean,
    onQuestionTimeUp: () -> Unit,
) {
    val question = run.question ?: return
    val counts = run.counts
    val place = run.sectionPlace()
    val spokenPlace = questionPlace(place, question.question.area)

    val progressLabel = stringResource(R.string.mock_progress_label)

    Column(Modifier.fillMaxWidth()) {
        LinearProgressIndicator(
            progress = { if (counts.total > 0) counts.answered / counts.total.toFloat() else 0f },
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = progressLabel },
            color = MaterialTheme.colorScheme.tertiary,
            trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
            drawStopIndicator = {},
        )
        Row(
            Modifier.fillMaxWidth().padding(vertical = 8.dp).semantics(mergeDescendants = true) {
                contentDescription =
                    spokenPlace
            },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val meta = MaterialTheme.typography.labelMedium.withTabularFigures()
            Text(
                listOfNotNull(mockTitle(run.view.number).takeIf { titled }, question.question.area).factsLine(),
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
private fun questionPlace(
    place: SectionPlace?,
    area: String?,
): String {
    if (place == null) {
        return area?.let { stringResource(R.string.mock_written_part_area, it) }
            ?: stringResource(R.string.mock_written_part)
    }
    return mockQuestionPlace(place.number, place.total, area)
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
        // At large fonts the top bar keeps only the time; TalkBack still hears what it is.
        if (large || LocalDensity.current.fontScale < LARGE_FONT_SCALE) {
            Text(
                stringResource(R.string.mock_time_left_caption),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

/** Not sure and Next: across the phone's foot, or at the end of the question's column beside the sheet, as main's. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RunnerActions(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    tip: TooltipState,
    onUnsure: () -> Unit,
    onHandIn: () -> Unit,
) {
    val question = run.question
    val unsure = question != null && run.drafts[question.itemId]?.unsure == true
    val last = run.position >= run.questions.lastIndex
    val handingIn = run.busy == MockStep.Submit

    TaskActionBar {
        TaskActions { width ->
            UnsureButton(on = unsure, tip = tip, forwardOnly = run.moves.forwardOnly, onClick = onUnsure)
            MockMainButton(
                text =
                    when {
                        !last -> stringResource(R.string.mock_next)
                        run.isLastSection -> stringResource(R.string.mock_hand_in)
                        else -> stringResource(R.string.mock_hand_in_section)
                    },
                busy = handingIn,
                enabled = !run.pending && run.moves.canAdvance,
                onClick = { if (last) onHandIn() else viewModel.go(run.position + 1) },
                modifier = width,
            )
        }
    }
}

/** Main's `MockQuestionMap`: the stretch of seven questions that holds the one on screen, to jump between. */
@Composable
private fun QuestionMap(
    run: MockRun,
    onPick: (Int) -> Unit,
) {
    if (run.questions.size <= 1) return
    BoxWithConstraints {
        // Main's strip shows seven; a narrow window fits fewer once each is a separate 48dp target.
        val perRow = ((maxWidth + MAP_GAP) / (MAP_TARGET + MAP_GAP)).toInt().coerceIn(1, MAP_ROW)
        val start = run.position / perRow * perRow
        val shown = run.questions.drop(start).take(perRow)
        Row(horizontalArrangement = Arrangement.spacedBy(MAP_GAP)) {
            shown.forEachIndexed { offset, question ->
                QuestionCell(run, start + offset, question, onPick, Modifier.weight(1f))
            }
            repeat(perRow - shown.size) { Box(Modifier.weight(1f)) }
        }
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
            counts.blank > 0 && counts.unsure > 0 -> {
                stringResource(
                    R.string.mock_left_blank_and_unsure,
                    pluralStringResource(R.plurals.mock_left_blank, counts.blank, counts.blank),
                    pluralStringResource(R.plurals.mock_left_unsure, counts.unsure, counts.unsure),
                )
            }

            counts.blank > 0 -> {
                pluralStringResource(R.plurals.mock_left_blank_only, counts.blank, counts.blank)
            }

            counts.unsure > 0 -> {
                pluralStringResource(R.plurals.mock_left_unsure_only, counts.unsure, counts.unsure)
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
                listOf(questions, essays, stringResource(R.string.mock_hand_in_final)).filter(String::isNotEmpty).joinSentences(),
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
@Composable
private fun AnswerSheet(
    run: MockRun,
    onPick: (Int) -> Unit,
    withMoves: Boolean = false,
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val label = stringResource(R.string.mock_questions)
            // Main's `auto-fill minmax(2.75rem, 1fr)`: as many 48dp cells a row as fit, filling it edge to edge.
            BoxWithConstraints(Modifier.semantics { contentDescription = label }) {
                val perRow = ((maxWidth + SHEET_GAP) / (MAP_TARGET + SHEET_GAP)).toInt().coerceAtLeast(1)
                Column(verticalArrangement = Arrangement.spacedBy(SHEET_GAP)) {
                    run.questions.withIndex().chunked(perRow).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(SHEET_GAP)) {
                            row.forEach { (index, question) ->
                                QuestionCell(run, index, question, onPick, Modifier.weight(1f))
                            }
                            repeat(perRow - row.size) { Box(Modifier.weight(1f)) }
                        }
                    }
                }
            }
            if (withMoves) MovesNote(run.moves)
        }
        SheetNotes(run)
        if (run.view.sections.size > 1) SheetSections(run)
    }
}

@Composable
private fun SheetNotes(run: MockRun) {
    val tools = run.currentSection?.tools ?: return
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            painterResource(R.drawable.ic_edit_square),
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(tools, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

/** The mock's sections with the one running, as on the answer sheet and the break. */
@Composable
internal fun SheetSections(
    run: MockRun,
    titled: Boolean = true,
) {
    val counts = run.counts
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (titled) Text(stringResource(R.string.mock_sections), style = MaterialTheme.typography.titleSmall)
        run.view.sections.forEachIndexed { index, section ->
            if (index > 0) HorizontalDivider()
            val current = section.status == MockExamSectionsInner.Status.CURRENT
            val total = if (current && run.view.current != null) counts.total.toLong() else section.questions + section.essays
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
                    mockSectionTitle(section),
                    Modifier.weight(1f),
                    color =
                        if (current) {
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
                            R.string.mock_section_answered_of,
                            formatNumber((if (current) counts.answered else 0).toDouble(), locale),
                            formatNumber(total.toDouble(), locale),
                        )
                    },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

/** "34 answered · 3 not sure", the second only once one is marked. */
@Composable
private fun sheetCounts(counts: SectionCounts): String =
    factsLine(
        pluralStringResource(R.plurals.mock_answered_count, counts.answered, counts.answered),
        counts.unsure.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.mock_unsure_count, it, it) },
    )

private const val MAP_ROW = 7
private val MAP_GAP = 8.dp
private val MAP_TARGET = 48.dp
private val SHEET_GAP = 8.dp
private const val LARGE_FONT_SCALE = 1.5f
private val NUMBER_KEYS = listOf(Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine)
private val NUMPAD_KEYS =
    listOf(Key.NumPad1, Key.NumPad2, Key.NumPad3, Key.NumPad4, Key.NumPad5, Key.NumPad6, Key.NumPad7, Key.NumPad8, Key.NumPad9)
