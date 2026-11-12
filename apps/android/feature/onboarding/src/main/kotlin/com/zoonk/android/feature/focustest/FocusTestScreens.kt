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
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestSitting

@Composable
internal fun aboutMinutes(minutes: Int): String = stringResource(R.string.focustest_about, formatMinutes(minutes, currentLocale()))

@Composable
internal fun aboutMinutesLeft(minutes: Int): String = stringResource(R.string.focustest_about_left, formatMinutes(minutes, currentLocale()))

/** The line above a test screen's headline: the test's name, and what starting it costs when it does. */
@Composable
internal fun TestEyebrow(cost: String? = null) {
    Eyebrow(listOfNotNull(stringResource(R.string.focustest_title), cost).factsLine())
}

/** A test screen's one headline, with its line above and at most one line under it, said again when [announced] and it changes. */
@Composable
internal fun TestHeader(
    title: String,
    description: String? = null,
    eyebrow: @Composable () -> Unit = { TestEyebrow() },
    announced: Boolean = false,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        eyebrow()
        OnboardingHeading(title)
        description?.let { Note(it, if (announced) Modifier.semantics { liveRegion = LiveRegionMode.Polite } else Modifier) }
    }
}

@Composable
internal fun Note(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

/** Only a dated exam with several subjects has a focus to find; any other has a starting point. */
private fun FocusTest.findsFocus() = dated && subjects.size > 1

/** [onPlan]: the plan is already the learner's, so leaving it doesn't skip a step. */
@Composable
internal fun ColumnScope.FocusTestOffer(
    test: FocusTest,
    minutes: Int,
    onPlan: Boolean,
    pressed: Pressed?,
    failed: Boolean,
    onStart: () -> Unit,
    onSkip: () -> Unit,
) {
    val focus = test.findsFocus()
    SetupContent {
        TestHeader(
            title = stringResource(if (focus) R.string.focustest_find_focus else R.string.focustest_find_start),
            description = stringResource(if (focus) R.string.focustest_offer_description_focus else R.string.focustest_offer_description),
            eyebrow = { TestEyebrow(aboutMinutes(minutes)) },
        )
        HowItWorks()
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
                Text(stringResource(if (onPlan) R.string.focustest_not_now else R.string.focustest_skip_for_now))
            }
        }
    }
}

@Composable
internal fun ColumnScope.FocusTestResume(
    sitting: FocusTestSitting,
    pressed: Pressed?,
    failed: Boolean,
    onContinue: () -> Unit,
    onSeeResult: () -> Unit,
) {
    val answered = sitting.answered.toInt()
    SetupContent {
        TestHeader(
            title = stringResource(R.string.focustest_resume_title),
            description = pluralStringResource(R.plurals.focustest_answers_saved_line, answered, answered),
            eyebrow = { TestEyebrow(aboutMinutesLeft(sitting.minutes.toInt())) },
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
            TextButton(busy = pressed == Pressed.Other, onClick = onSeeResult, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.focustest_see_my_result))
            }
        }
    }
}

/** A sitting with nothing more to ask that isn't closed yet: the learner came back to it, or closing it failed. */
@Composable
internal fun ColumnScope.FocusTestEnded(
    pending: Boolean,
    failed: Boolean,
    onFinish: () -> Unit,
) {
    SetupContent {
        TestHeader(stringResource(R.string.focustest_answers_saved_title))
        OnboardingActions {
            FinishFailed(failed)
            Button(busy = pending, onClick = onFinish, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.focustest_see_my_result))
            }
        }
    }
}
