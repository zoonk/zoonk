package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.labelCase
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestSitting

/** Where the test runs: inside onboarding, before the plan is shown, or on a plan already there. */
internal enum class FocusTestHost { Onboarding, Plan }

@Composable
internal fun aboutMinutes(minutes: Int): String = stringResource(R.string.focustest_about, formatMinutes(minutes, currentLocale()))

/** The time is the screen's one big number: it's what decides whether someone starts. */
@Composable
private fun SittingSize(
    minutes: Int,
    facts: List<String>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Readout(aboutMinutes(minutes), style = MaterialTheme.typography.displaySmall)
        Facts(facts)
    }
}

@Composable
private fun TestHeading(
    subject: String,
    title: String,
    description: String? = null,
) {
    Eyebrow(subject.labelCase())
    OnboardingHeading(title, description)
}

@Composable
private fun Note(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
internal fun ColumnScope.FocusTestInvitation(
    test: FocusTest,
    next: NextSitting,
    host: FocusTestHost,
    subject: String,
    pressed: Pressed?,
    failed: Boolean,
    onStart: () -> Unit,
    onSkip: () -> Unit,
) {
    val subjects = test.counts.total.toInt()
    SetupContent {
        TestHeading(
            subject,
            stringResource(if (test.dated) R.string.focustest_invitation_title_dated else R.string.focustest_invitation_title),
            stringResource(
                if (test.dated &&
                    subjects > 1
                ) {
                    R.string.focustest_invitation_description_focus
                } else {
                    R.string.focustest_invitation_description
                },
            ),
        )
        SittingSize(
            next.minutes,
            listOf(
                stringResource(R.string.focustest_optional),
                pluralStringResource(R.plurals.focustest_up_to_questions, next.questions, next.questions),
                pluralStringResource(R.plurals.focustest_subjects_count, subjects, subjects),
            ),
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.focustest_no_grade), style = MaterialTheme.typography.bodyMedium)
            Text(stringResource(R.string.focustest_stop_any_time), style = MaterialTheme.typography.bodyMedium)
        }
        if (next.pastCeiling > 0) {
            Column {
                Note(
                    joinSentences(
                        pluralStringResource(R.plurals.focustest_past_ceiling_subjects, subjects, subjects),
                        pluralStringResource(R.plurals.focustest_past_ceiling_questions, next.questions, next.questions),
                    ),
                )
                SubjectsButton(test.subjects, answered = false)
            }
        }
        OnboardingActions {
            FinishFailed(failed)
            Button(
                busy = pressed == Pressed.Main,
                onClick = onStart,
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed != Pressed.Other,
                leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
            ) {
                Text(stringResource(R.string.focustest_start))
            }
            TextButton(
                busy = pressed == Pressed.Other,
                onClick = onSkip,
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed != Pressed.Main,
            ) {
                Text(stringResource(if (host == FocusTestHost.Onboarding) R.string.focustest_skip_for_now else R.string.focustest_not_now))
            }
        }
    }
}

@Composable
internal fun ColumnScope.FocusTestResume(
    sitting: FocusTestSitting,
    subject: String,
    pressed: Pressed?,
    failed: Boolean,
    onContinue: () -> Unit,
    onUseAnswers: () -> Unit,
) {
    val answered = sitting.answered.toInt()
    val left = sitting.left.toInt()
    SetupContent {
        TestHeading(subject, stringResource(R.string.focustest_resume_title))
        SittingSize(
            sitting.minutes.toInt(),
            listOf(
                pluralStringResource(R.plurals.focustest_answers_saved, answered, answered),
                pluralStringResource(R.plurals.focustest_up_to_questions_left, left, left),
            ),
        )
        OnboardingActions {
            FinishFailed(failed)
            Button(
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed == null,
                leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
            ) {
                Text(stringResource(R.string.focustest_continue))
            }
            OutlinedButton(busy = pressed == Pressed.Other, onClick = onUseAnswers, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.focustest_use_my_answers))
            }
        }
    }
}

@Composable
internal fun endLine(end: FocusTestSitting.End?): String? =
    when (end) {
        FocusTestSitting.End.SETTLED -> stringResource(R.string.focustest_end_settled)
        FocusTestSitting.End.NO_QUESTIONS_READY -> stringResource(R.string.focustest_end_no_questions)
        FocusTestSitting.End.CEILING, null -> null
    }

@Composable
internal fun ColumnScope.FocusTestEnded(
    end: FocusTestSitting.End?,
    subject: String,
    pending: Boolean,
    failed: Boolean,
    onFinish: () -> Unit,
) {
    SetupContent {
        TestHeading(subject, stringResource(R.string.focustest_answers_saved_title), endLine(end))
        OnboardingActions {
            FinishFailed(failed)
            Button(busy = pending, onClick = onFinish, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.focustest_see_starting_plan))
            }
        }
    }
}

@Composable
internal fun ColumnScope.FocusTestCheckpoint(
    test: FocusTest,
    end: FocusTestSitting.End?,
    host: FocusTestHost,
    subject: String,
    pressed: Pressed?,
    failed: Boolean,
    proposal: ProposalControls?,
    onDone: () -> Unit,
    onContinueTest: () -> Unit,
) {
    val next = nextSitting(test)
    SetupContent {
        TestHeading(subject, stringResource(R.string.focustest_checkpoint_title))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val asked = test.counts.asked.toInt()
            val total = test.counts.total.toInt()
            Note(pluralStringResource(R.plurals.focustest_evidence, total, asked, total))
            endLine(end)?.let { Note(it, Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
        }
        FocusTestResult(test, proposal)
        OnboardingActions {
            FinishFailed(failed)
            Button(
                busy = pressed == Pressed.Main,
                onClick = onDone,
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed != Pressed.Other,
            ) {
                Text(
                    stringResource(
                        if (host ==
                            FocusTestHost.Onboarding
                        ) {
                            R.string.focustest_continue_to_daily_time
                        } else {
                            R.string.focustest_done
                        },
                    ),
                )
            }
            next?.let {
                OutlinedButton(
                    busy = pressed == Pressed.Other,
                    onClick = onContinueTest,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = pressed != Pressed.Main,
                ) {
                    Text(stringResource(R.string.focustest_continue_test, formatMinutes(it.minutes, currentLocale())))
                }
            }
        }
    }
}
