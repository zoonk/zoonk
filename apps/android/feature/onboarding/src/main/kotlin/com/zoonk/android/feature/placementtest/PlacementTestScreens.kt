package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
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
) {
    val locale = currentLocale()
    var choice by rememberSaveable {
        mutableStateOf(
            initial.takeIf { it != TestChoice.TestOut || testOutLevel != null } ?: TestChoice.Quick,
        )
    }
    val title = stringResource(R.string.placementtest_choose_title)
    val choices =
        listOfNotNull(
            Choice(
                TestChoice.Quick,
                stringResource(R.string.placementtest_quick),
                stringResource(R.string.placementtest_about, formatMinutes(QUICK_TEST_MINUTES, locale)),
            ),
            Choice(
                TestChoice.WholeCourse,
                stringResource(R.string.placementtest_whole_course),
                if (wholeCourseMinutes > 0) {
                    stringResource(R.string.placementtest_about_in_parts, formatMinutes(wholeCourseMinutes, locale))
                } else {
                    stringResource(R.string.placementtest_in_parts)
                },
            ),
            testOutLevel?.let {
                Choice(
                    TestChoice.TestOut,
                    stringResource(R.string.placementtest_test_out, it),
                    stringResource(R.string.placementtest_test_out_description, it),
                )
            },
        )

    SetupContent {
        OnboardingHeading(title)
        ChoiceList(choices, choice, title, onChange = { choice = it })
        Note(stringResource(R.string.placementtest_choose_note))
        OnboardingActions {
            FinishFailed(failed)
            Button(
                busy = pressed == Pressed.Main,
                onClick = {
                    when (choice) {
                        TestChoice.Quick -> onStart(PlacementLength.QUICK)
                        TestChoice.WholeCourse -> onStart(PlacementLength.WHOLE_COURSE)
                        TestChoice.TestOut -> onTestOut()
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed == null,
            ) {
                Text(stringResource(R.string.placementtest_start))
            }
            if (onSkip != null) {
                TextButton(onClick = onSkip, modifier = Modifier.fillMaxWidth(), enabled = pressed == null) {
                    Text(stringResource(R.string.onboarding_skip))
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
    undo: (@Composable () -> Unit)? = null,
    inSetup: Boolean = false,
) {
    SetupContent {
        OnboardingHeading(
            lessonsSkipped?.let { lessonsSkippedLine(it) } ?: stringResource(R.string.placementtest_continue_title),
            stringResource(R.string.placementtest_left_saved, formatMinutes(minutesLeft, currentLocale())),
        )
        undo?.invoke()
        if (inSetup) Note(stringResource(R.string.placementtest_continue_from_plan))
        OnboardingActions {
            FinishFailed(failed)
            Button(
                busy = pressed == Pressed.Main,
                onClick = onKeepGoing,
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed == null,
            ) {
                Text(stringResource(if (inSetup) R.string.onboarding_continue else R.string.placementtest_keep_going))
            }
            if (!inSetup) {
                TextButton(
                    onClick = onFinishForToday,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = pressed == null,
                ) {
                    Text(stringResource(R.string.placementtest_finish_for_today))
                }
            }
        }
    }
}

/** Main's `PlacementResult`: what the test skipped, and where the plan goes on. */
@Composable
internal fun ColumnScope.PlacementResult(
    length: PlacementLength,
    lessonsSkipped: Int,
    nextTopic: String?,
    onDone: () -> Unit,
    undo: (@Composable () -> Unit)? = null,
    inSetup: Boolean = false,
    saving: Boolean = false,
) {
    TestOutcome(
        title = lessonsSkippedLine(lessonsSkipped),
        lead = stringResource(if (lessonsSkipped > 0) R.string.placementtest_known else R.string.placementtest_plan_stays),
        action = stringResource(if (inSetup) R.string.onboarding_continue else R.string.placementtest_done),
        onAction = onDone,
        busy = saving,
        enabled = !saving,
    ) {
        nextTopic?.let {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surfaceContainerLow,
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Eyebrow(stringResource(R.string.placementtest_up_next))
                    Text(it, style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        undo?.invoke()
        if (length == PlacementLength.QUICK) Note(stringResource(R.string.placementtest_whole_course_skips_more))
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
    other: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    SetupContent {
        OnboardingHeading(title, lead)
        content()
        OnboardingActions {
            FinishFailed(failed)
            Button(busy = busy, onClick = onAction, modifier = Modifier.fillMaxWidth(), enabled = enabled) { Text(action) }
            other?.invoke()
        }
    }
}

/** Today's budget for the quick test, as core's placement budget sets it. */
private const val QUICK_TEST_MINUTES = 4
