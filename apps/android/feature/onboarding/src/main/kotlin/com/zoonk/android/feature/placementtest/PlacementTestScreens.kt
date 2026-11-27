package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TestRow
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.focustest.Note
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.onboarding.start.OnboardingSubject
import com.zoonk.android.feature.plan.lessonsSkippedLine
import com.zoonk.android.feature.plan.restoredLessonsLine
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.BarError

/** One of the offer's rows: what it starts ([id]), its name and its facts. */
internal data class OfferRow(
    val id: TestRow,
    val label: String,
    val line: String,
)

/** "First lesson": onboarding's way to decline, which says where declining goes. */
@Composable
internal fun firstLessonRow() =
    OfferRow(
        TestRow.FirstLesson,
        stringResource(R.string.placementtest_first_lesson),
        stringResource(R.string.placementtest_first_lesson_line),
    )

/** A test's facts: its questions and about how long they take. */
@Composable
internal fun testFacts(
    questions: Int,
    minutes: Int,
): List<String> =
    listOf(
        pluralStringResource(R.plurals.placementtest_questions, questions, questions),
        stringResource(R.string.placementtest_about, formatMinutes(minutes, currentLocale())),
    )

/** The full test's facts: its parts, each on a day of the learner's choosing, and about how long they all take. */
@Composable
internal fun fullTestFacts(
    parts: Int,
    minutes: Int,
): List<String> =
    listOf(
        pluralStringResource(R.plurals.placementtest_parts_any_day, parts, parts),
        stringResource(R.string.placementtest_about, formatMinutes(minutes, currentLocale())),
    )

/**
 * Main's `TestOffer`, one piece for every test: its message, the [rows] to pick from, and one main action that follows
 * the row picked. A single test ([rows] of one) has nothing to pick, so it shows under its [chip] with its [facts]
 * instead. [initial] is the row it opens with. [onNotNow] is the Plan's way out; onboarding has none, since its first
 * row is the way to decline. [test] says the offer was shown, once per time it shows.
 */
@Composable
internal fun ColumnScope.TestOffer(
    title: String,
    sentence: String,
    rows: List<OfferRow>,
    initial: TestRow,
    pressed: Pressed?,
    failed: Boolean,
    onChoose: (TestRow) -> Unit,
    test: TestContext,
    chip: String? = null,
    facts: List<String> = emptyList(),
    onNotNow: (() -> Unit)? = null,
) {
    var selected by rememberSaveable { mutableStateOf(initial.takeIf { id -> rows.any { it.id == id } } ?: rows.first().id) }
    val row = rows.firstOrNull { it.id == selected } ?: rows.first()
    TrackShown(AnalyticsEvent.TestOffered(test, rows.map { it.id }, initial))

    SetupContent {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (rows.size == 1) chip?.let { OnboardingSubject(it, facts.factsLine().takeIf(String::isNotEmpty)) }
            OnboardingHeading(title, sentence)
        }
        if (rows.size > 1) {
            ChoiceList(
                choices = rows.map { Choice(it.id, it.label, it.line) },
                value = row.id,
                label = title,
                onChange = { selected = it },
                readOnly = pressed != null,
            )
        }
        OnboardingActions {
            FinishFailed(failed)
            TaskActions { main ->
                onNotNow?.let {
                    OutlinedButton(onClick = it, enabled = pressed == null) { Text(stringResource(R.string.placementtest_not_now)) }
                }
                Button(busy = pressed == Pressed.Main, onClick = { onChoose(row.id) }, modifier = main, enabled = pressed == null) {
                    Text(
                        stringResource(
                            if (row.id == TestRow.FirstLesson || row.id == TestRow.Continue) {
                                R.string.onboarding_continue
                            } else {
                                R.string.placementtest_start
                            },
                        ),
                    )
                }
            }
        }
    }
}

/** "This part skipped 2 lessons you already know.", or that it skipped none. */
@Composable
internal fun partSkippedLine(lessons: Int): String =
    if (lessons == 0) {
        stringResource(R.string.placementtest_part_skipped_none)
    } else {
        pluralStringResource(R.plurals.placementtest_part_skipped, lessons, lessons)
    }

/** The parts the full test has left and about how long they all take, by the server's estimate. */
@Composable
internal fun partsLeftFacts(
    partsLeft: Int,
    minutesLeft: Int,
): List<String> =
    listOfNotNull(
        pluralStringResource(R.plurals.placementtest_parts_left, partsLeft, partsLeft),
        minutesLeft.takeIf { it > 0 }?.let { stringResource(R.string.placementtest_about, formatMinutes(it, currentLocale())) },
    )

/**
 * After a part of the full test (main's `PlacementCheckpoint`): it's done, what it skipped and what's left. "Keep going"
 * goes on with the next part; "Finish later" leaves the rest for another day.
 */
@Composable
internal fun ColumnScope.PartDone(
    part: Int,
    parts: Int,
    lessonsSkipped: Int,
    heldUntilTomorrow: Boolean,
    partsLeft: Int,
    minutesLeft: Int,
    pressed: Pressed?,
    failed: Boolean,
    onFinishLater: () -> Unit,
    onKeepGoing: () -> Unit,
    undo: PlacementUndoViewModel?,
) {
    val restored = undo?.restoredLessons
    SetupContent {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OnboardingHeading(
                stringResource(R.string.placementtest_part_done, part, parts),
                when {
                    restored != null -> restoredLessonsLine(restored)
                    heldUntilTomorrow && lessonsSkipped == 0 -> stringResource(R.string.placementtest_retake_tomorrow)
                    else -> partSkippedLine(lessonsSkipped)
                },
                announceDescription = restored != null,
            )
            Facts(partsLeftFacts(partsLeft, minutesLeft))
        }
        TestActions(
            action = stringResource(R.string.placementtest_keep_going),
            onAction = onKeepGoing,
            busy = pressed == Pressed.Main,
            enabled = pressed == null,
            failed = failed,
            undo = undo,
        ) {
            OutlinedButton(onClick = onFinishLater, enabled = pressed == null && undo?.saving != true) {
                Text(stringResource(R.string.placementtest_finish_later))
            }
        }
    }
}

/**
 * The full test stopped with questions left in its part: the answers count, and the test picks up at [part]'s
 * [question] next time, never "done".
 */
@Composable
internal fun ColumnScope.PartStopped(
    part: Int,
    parts: Int,
    question: Int,
    lessonsSkipped: Int,
    action: String,
    onAction: () -> Unit,
    busy: Boolean,
    undo: PlacementUndoViewModel?,
) {
    val restored = undo?.restoredLessons
    SetupContent {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OnboardingHeading(
                stringResource(R.string.focustest_answers_saved_title),
                restored?.let { restoredLessonsLine(it) } ?: partSkippedLine(lessonsSkipped),
                announceDescription = restored != null,
            )
            Facts(listOf(stringResource(R.string.placementtest_next_time, part, parts, question)))
        }
        TestActions(action, onAction, busy = busy, enabled = !busy, failed = false, undo = undo)
    }
}

/**
 * A full test with parts left, opened again (main's `PlacementContinue`): where it stands, and the way back in. [other]
 * is the way out: "Not now" on the Plan, "Finish later" in the setup.
 */
@Composable
internal fun ColumnScope.ContinueTest(
    facts: List<String>,
    pressed: Pressed?,
    failed: Boolean,
    onContinue: () -> Unit,
    other: String,
    onOther: () -> Unit,
) {
    SetupContent {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OnboardingSubject(stringResource(R.string.placementtest_title), facts.factsLine())
            OnboardingHeading(stringResource(R.string.placementtest_continue_title))
        }
        TestActions(
            stringResource(R.string.focustest_continue),
            onContinue,
            busy = pressed == Pressed.Main,
            enabled = pressed == null,
            failed,
        ) {
            OutlinedButton(onClick = onOther, enabled = pressed == null) { Text(other) }
        }
    }
}

@Composable
internal fun placementKnownLine(lessons: Int): String =
    stringResource(if (lessons == 1) R.string.placementtest_known_one else R.string.placementtest_known_other)

/** A result's next lesson, under "Up next", until an Undo puts the skipped lessons back. */
@Composable
internal fun UpNext(title: String) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Eyebrow(stringResource(R.string.placementtest_up_next))
            Text(title, style = MaterialTheme.typography.titleSmall)
        }
    }
}

/**
 * Main's `PlacementResult`: what the course test skipped in all, and where the plan goes on ([nextLesson]). A quick test
 * with parts left says them and offers [onTestTheRest].
 */
@Composable
internal fun ColumnScope.PlacementResult(
    lessonsSkipped: Int,
    nextLesson: String?,
    action: String,
    onAction: () -> Unit,
    undo: PlacementUndoViewModel? = null,
    busy: Boolean = false,
    pressed: Pressed? = null,
    failed: Boolean = false,
    heldUntilTomorrow: Boolean = false,
    rest: List<String> = emptyList(),
    onTestTheRest: (() -> Unit)? = null,
) {
    TestOutcome(
        title = lessonsSkippedLine(lessonsSkipped),
        lead =
            when {
                lessonsSkipped > 0 -> placementKnownLine(lessonsSkipped)
                heldUntilTomorrow -> stringResource(R.string.placementtest_retake_tomorrow)
                else -> stringResource(R.string.placementtest_plan_stays)
            },
        facts = rest,
        action = action,
        onAction = onAction,
        busy = busy || pressed == Pressed.Main,
        enabled = !busy && pressed == null,
        failed = failed,
        undo = undo,
        other =
            onTestTheRest?.let {
                {
                    OutlinedButton(
                        onClick = it,
                        busy = pressed == Pressed.Other,
                        enabled = !busy && pressed == null && undo?.saving != true,
                    ) {
                        Text(stringResource(R.string.placementtest_test_the_rest))
                    }
                }
            },
    ) {
        nextLesson?.takeIf { undo?.restoredLessons == null }?.let { UpNext(it) }
    }
}

/** Main's `TestOutcome`: the end of a test, what it found under its heading, and the way on. */
@Composable
internal fun ColumnScope.TestOutcome(
    title: String,
    lead: String?,
    action: String,
    onAction: () -> Unit,
    busy: Boolean = false,
    enabled: Boolean = true,
    failed: Boolean = false,
    undo: PlacementUndoViewModel? = null,
    facts: List<String> = emptyList(),
    other: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    SetupContent {
        val restored = undo?.restoredLessons
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OnboardingHeading(
                if (restored != null) lessonsSkippedLine(0) else title,
                if (restored != null) restoredLessonsLine(restored) else lead,
                announceDescription = restored != null,
            )
            if (facts.isNotEmpty()) Facts(facts)
        }
        content()
        TestActions(action, onAction, busy, enabled, failed, undo, other)
    }
}

@Composable
private fun TestActions(
    action: String,
    onAction: () -> Unit,
    busy: Boolean,
    enabled: Boolean,
    failed: Boolean,
    undo: PlacementUndoViewModel? = null,
    other: (@Composable () -> Unit)? = null,
) {
    val undoFailure = if (undo?.failed == true) stringResource(R.string.plan_undo_failed) else null
    OnboardingActions(note = undoFailure?.let { { BarError(it) } }) {
        FinishFailed(failed)
        TaskActions { main ->
            PlacementUndoButton(undo, enabled = enabled && !busy)
            other?.invoke()
            Button(busy = busy, onClick = onAction, modifier = main, enabled = enabled && undo?.saving != true) { Text(action) }
        }
    }
}

/** "Part 3 of 14 · Question 5 of 12" in the full test, "Question 5 of 12" otherwise. */
@Composable
internal fun questionPosition(
    number: Int,
    total: Int,
    part: Int? = null,
    parts: Int? = null,
): String {
    val question = stringResource(R.string.onboarding_test_question_progress, number, total)
    return if (part != null && parts != null) factsLine(stringResource(R.string.placementtest_part_of, part, parts), question) else question
}
