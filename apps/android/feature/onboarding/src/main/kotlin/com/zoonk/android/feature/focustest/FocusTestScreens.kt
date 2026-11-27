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
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TestRow
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.onboarding.start.OnboardingSubject
import com.zoonk.android.feature.placementtest.OfferRow
import com.zoonk.android.feature.placementtest.TestOffer
import com.zoonk.android.feature.placementtest.firstLessonRow
import com.zoonk.android.feature.placementtest.testFacts
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.FocusTest

/**
 * A test screen's one headline, under the test's name with [position] (how long it takes, or what's left) at that row's
 * end, and at most one line under it, said again when [announced] and it changes.
 */
@Composable
internal fun TestHeader(
    title: String,
    description: String? = null,
    position: String? = null,
    announced: Boolean = false,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OnboardingSubject(stringResource(R.string.focustest_title), position)
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

/**
 * The Focus test's offer: in onboarding, "First lesson" or the test; on the plan, the test with its facts and "Not now".
 * [onPlan]: the plan is already the learner's, so leaving it doesn't skip a step.
 */
@Composable
internal fun ColumnScope.FocusTestOffer(
    test: FocusTest,
    minutes: Int,
    onPlan: Boolean,
    pressed: Pressed?,
    failed: Boolean,
    onStart: () -> Unit,
    onSkip: () -> Unit,
    analytics: TestContext,
) {
    val focus = test.suggestsFocus
    val facts = testFacts(test.offer?.questions?.toInt() ?: 0, minutes)
    val testRow = OfferRow(TestRow.Quick, stringResource(R.string.focustest_title), facts.factsLine())
    TestOffer(
        title =
            when {
                !onPlan -> stringResource(R.string.placementtest_where_to_start)
                focus -> stringResource(R.string.focustest_find_focus)
                else -> stringResource(R.string.focustest_find_start)
            },
        sentence = stringResource(if (focus) R.string.focustest_offer_line_focus else R.string.focustest_offer_line),
        rows = if (onPlan) listOf(testRow) else listOf(firstLessonRow(), testRow),
        initial = TestRow.Quick,
        pressed = pressed,
        failed = failed,
        onChoose = { if (it == TestRow.FirstLesson) onSkip() else onStart() },
        test = analytics,
        chip = stringResource(R.string.focustest_title),
        facts = facts,
        onNotNow = onSkip.takeIf { onPlan },
    )
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
