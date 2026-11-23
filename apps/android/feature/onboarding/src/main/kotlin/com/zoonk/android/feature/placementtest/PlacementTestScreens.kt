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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.focustest.Note
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.plan.lessonsSkippedLine
import com.zoonk.android.feature.plan.restoredLessonsLine
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.BarError
import com.zoonk.api.models.PlacementLength

/** What the length screen starts: a length of the test, or a language level's test-out. */
internal enum class TestChoice { Quick, WholeCourse, TestOut }

/**
 * Main's `PlacementLengthChoice`: how much to check. A language course's next level to test out of
 * ([testOutLevel]) is offered beside the two lengths; [initial] is the choice it opens with.
 */
@Composable
internal fun ColumnScope.LengthChoice(
    wholeCourseMinutes: Int,
    pressed: Pressed?,
    failed: Boolean,
    onStart: (PlacementLength) -> Unit,
    testOutLevel: String? = null,
    initial: TestChoice = TestChoice.Quick,
    onTestOut: () -> Unit = {},
    onSkip: (() -> Unit)? = null,
    notes: @Composable () -> Unit = {},
) {
    val locale = currentLocale()
    var selected by rememberSaveable {
        mutableStateOf(initial.takeIf { it != TestChoice.TestOut || testOutLevel != null } ?: TestChoice.Quick)
    }
    val lengthLabel = stringResource(R.string.placementtest_choose_title)
    val choices =
        listOfNotNull(
            Choice(
                TestChoice.Quick,
                stringResource(R.string.placementtest_quick),
                stringResource(R.string.placementtest_about, formatMinutes(QUICK_TEST_MINUTES, locale)),
            ),
            wholeCourseMinutes.takeIf { it > 0 }?.let {
                Choice(
                    TestChoice.WholeCourse,
                    stringResource(R.string.placementtest_whole_course),
                    stringResource(R.string.placementtest_about_in_parts, formatMinutes(it, locale)),
                )
            },
            testOutLevel?.let {
                Choice(
                    TestChoice.TestOut,
                    stringResource(R.string.placementtest_test_out, it),
                    stringResource(R.string.placementtest_test_out_description, it),
                )
            },
        )

    val choice = selected.takeIf { value -> choices.any { it.value == value } } ?: TestChoice.Quick

    SetupContent {
        OnboardingHeading(
            stringResource(R.string.placementtest_start_title),
            if (choices.size > 1) {
                stringResource(R.string.placementtest_choose_description)
            } else {
                stringResource(R.string.placementtest_quick_only_description, formatMinutes(QUICK_TEST_MINUTES, locale))
            },
        )
        if (choices.size > 1) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(lengthLabel, style = MaterialTheme.typography.labelLarge)
                ChoiceList(choices, choice, lengthLabel, onChange = { selected = it })
            }
        }
        notes()
        OnboardingActions {
            FinishFailed(failed)
            TaskActions { main ->
                if (onSkip != null) {
                    OutlinedButton(
                        onClick = onSkip,
                        busy = pressed == Pressed.Other,
                        enabled = pressed == null,
                    ) {
                        Text(stringResource(R.string.onboarding_skip))
                    }
                }
                Button(
                    busy = pressed == Pressed.Main,
                    onClick = {
                        when (choice) {
                            TestChoice.Quick -> onStart(PlacementLength.QUICK)
                            TestChoice.WholeCourse -> onStart(PlacementLength.WHOLE_COURSE)
                            TestChoice.TestOut -> onTestOut()
                        }
                    },
                    modifier = main,
                    enabled = pressed == null,
                ) {
                    Text(stringResource(R.string.placementtest_start))
                }
            }
        }
    }
}

/** Main's `PlacementBetweenParts`: what the last part skipped, and the rest to do. */
@Composable
internal fun ColumnScope.BetweenParts(
    lessonsSkipped: Int?,
    minutesLeft: Int,
    pressed: Pressed?,
    failed: Boolean,
    onFinishForToday: () -> Unit,
    onKeepGoing: () -> Unit,
    undo: PlacementUndoViewModel? = null,
    inSetup: Boolean = false,
    heldUntilTomorrow: Boolean = false,
) {
    val shownLessons = if (undo?.restoredLessons != null) 0 else lessonsSkipped
    SetupContent {
        OnboardingHeading(
            shownLessons?.let { lessonsSkippedLine(it) } ?: stringResource(R.string.placementtest_continue_title),
            stringResource(R.string.placementtest_left_saved, formatMinutes(minutesLeft, currentLocale())),
        )
        if (heldUntilTomorrow && lessonsSkipped == 0) Note(stringResource(R.string.placementtest_retake_tomorrow))
        PlacementUndoStatus(undo)
        if (inSetup) Note(stringResource(R.string.placementtest_continue_from_plan))
        PlacementResultActions(
            action = stringResource(if (inSetup) R.string.onboarding_continue else R.string.placementtest_keep_going),
            onAction = onKeepGoing,
            busy = pressed == Pressed.Main,
            enabled = pressed == null,
            failed = failed,
            undo = undo,
            other = {
                if (!inSetup) {
                    OutlinedButton(
                        onClick = onFinishForToday,
                        enabled = pressed == null && undo?.saving != true,
                    ) {
                        Text(stringResource(R.string.placementtest_finish_for_today))
                    }
                }
            },
        )
    }
}

@Composable
internal fun placementKnownLine(lessons: Int): String =
    stringResource(if (lessons == 1) R.string.placementtest_known_one else R.string.placementtest_known_other)

/** Main's `PlacementResult`: what the test skipped, and where the plan goes on. */
@Composable
internal fun ColumnScope.PlacementResult(
    length: PlacementLength,
    lessonsSkipped: Int,
    nextTopic: String?,
    onDone: () -> Unit,
    undo: PlacementUndoViewModel? = null,
    inSetup: Boolean = false,
    saving: Boolean = false,
    heldUntilTomorrow: Boolean = false,
) {
    TestOutcome(
        title = lessonsSkippedLine(lessonsSkipped),
        lead =
            when {
                lessonsSkipped > 0 -> placementKnownLine(lessonsSkipped)
                heldUntilTomorrow -> stringResource(R.string.placementtest_retake_tomorrow)
                else -> stringResource(R.string.placementtest_plan_stays)
            },
        action = stringResource(if (inSetup) R.string.onboarding_continue else R.string.placementtest_done),
        onAction = onDone,
        busy = saving,
        enabled = !saving,
        undo = undo,
    ) {
        nextTopic?.takeIf { undo?.restoredLessons == null }?.let {
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Eyebrow(stringResource(R.string.placementtest_up_next))
                    Text(it, style = MaterialTheme.typography.titleSmall)
                }
            }
        }
        val undone = undo?.restoredLessons != null
        if (length == PlacementLength.QUICK && !inSetup && !undone) Note(stringResource(R.string.placementtest_whole_course_skips_more))
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
    other: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    SetupContent {
        val restored = undo?.restoredLessons
        OnboardingHeading(
            if (restored != null) lessonsSkippedLine(0) else title,
            if (restored != null) restoredLessonsLine(restored) else lead,
            announceDescription = restored != null,
        )
        content()
        PlacementResultActions(action, onAction, busy, enabled, failed, undo, other)
    }
}

@Composable
private fun PlacementResultActions(
    action: String,
    onAction: () -> Unit,
    busy: Boolean,
    enabled: Boolean,
    failed: Boolean,
    undo: PlacementUndoViewModel?,
    other: (@Composable () -> Unit)?,
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

/** Today's budget for the quick test, as core's placement budget sets it. */
private const val QUICK_TEST_MINUTES = 4
