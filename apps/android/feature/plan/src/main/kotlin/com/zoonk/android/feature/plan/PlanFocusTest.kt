package com.zoonk.android.feature.plan

import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.FocusTestOffer
import com.zoonk.api.models.FocusTestSessionQuestions
import com.zoonk.api.models.FocusTestSummary
import com.zoonk.api.models.Plan

/** The test's first sitting, for a learner who hasn't started it and whose time doesn't cover everything: where a focus would help most. */
fun focusTestOffer(plan: Plan): FocusTestOffer? =
    plan.focusTest
        ?.takeIf { it.state == FocusTestSummary.State.NOT_STARTED && planCoverage(plan) != null }
        ?.offer

/** The test's one line on the plan: what it's for and what it costs, what's left, or where its result is. */
@Composable
internal fun focusTestLine(summary: FocusTestSummary): String {
    val minutes = summary.offer?.minutes?.let { formatMinutes(it.toInt(), currentLocale()) }
    return when (summary.state) {
        FocusTestSummary.State.NOT_STARTED -> {
            factsLine(
                stringResource(if (summary.suggestsFocus) R.string.focustest_find_focus else R.string.focustest_find_start),
                minutes?.let { stringResource(R.string.focustest_about, it) },
            )
        }

        FocusTestSummary.State.SITTING -> {
            factsLine(stringResource(R.string.focustest_in_progress), minutes?.let { stringResource(R.string.focustest_about_left, it) })
        }

        FocusTestSummary.State.CHECKED -> {
            stringResource(
                if (summary.sessionQuestions == FocusTestSessionQuestions.PAUSED) {
                    R.string.focustest_paused_in_sessions
                } else {
                    R.string.focustest_see_your_result
                },
            )
        }
    }
}

/** The Focus test's place on the plan: its name and one line; what it can do is on the screen it opens. */
@Composable
internal fun PlanFocusTestRow(
    summary: FocusTestSummary,
    onOpen: () -> Unit,
) {
    ListRow(
        headline = { Text(stringResource(R.string.focustest_title)) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = onOpen,
        leading = { Icon(painterResource(R.drawable.ic_my_location), contentDescription = null) },
        supporting = { Text(focusTestLine(summary)) },
    )
}
