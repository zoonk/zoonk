package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.SpeakingPassRule
import com.zoonk.api.models.SpeakingSection
import com.zoonk.api.models.SpeakingSectionTasksInner

/** Main's `SpeakingStep`: the speaking paper's estimate once every task is graded, never an official score, and each task's feedback. */
@Composable
internal fun SpeakingEstimate(
    paper: SpeakingSection,
    onSeeFeedback: (SpeakingSectionTasksInner) -> Unit,
) {
    val estimate = paper.estimate
    val low = estimate.low
    val high = estimate.high
    val points = estimate.complete && low != null && high != null
    val done = paper.tasks.all { it.status == SpeakingSectionTasksInner.Status.COMPLETED }
    val locale = currentLocale()
    val number = { value: Double -> formatNumber(value, locale, maximumFractionDigits = 1) }
    val total = number(estimate.total)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow(paper.paper)
        StepTitle(
            when {
                low == null || high == null || !points -> stringResource(R.string.mock_result_no_estimate)
                low == high -> stringResource(R.string.mock_result_about_points, number(low), total)
                else -> stringResource(R.string.mock_result_about_range, number(low), number(high), total)
            },
        )
        StepDetail(
            when {
                points -> stringResource(R.string.mock_result_estimate_detail)
                !done -> stringResource(R.string.mock_result_not_every_task)
                estimate.typed -> stringResource(R.string.mock_result_typed_no_estimate)
                else -> stringResource(R.string.mock_result_task_not_graded)
            },
        )
        if (estimate.typed && points) StepDetail(stringResource(R.string.mock_result_typed_estimate))
        passRule(paper.pass)?.let { StepDetail(it) }
    }

    val label = stringResource(R.string.mock_result_tasks)
    Column(Modifier.semantics { contentDescription = label }) {
        paper.tasks.forEachIndexed { index, task ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(task.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                if (task.status == SpeakingSectionTasksInner.Status.COMPLETED) {
                    OutlinedButton(onClick = { onSeeFeedback(task) }) { Text(stringResource(R.string.mock_result_see_feedback)) }
                } else {
                    Text(
                        stringResource(R.string.mock_result_not_done),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}

@Composable
private fun passRule(pass: SpeakingPassRule): String? {
    val locale = currentLocale()
    val number = { value: Double -> formatNumber(value, locale) }
    return when (pass) {
        is SpeakingPassRule.SpeakingPassRuleOneOfValue -> {
            stringResource(
                R.string.mock_result_pass_group,
                number(pass.value.min),
                number(pass.value.of),
            )
        }

        is SpeakingPassRule.SpeakingPassRuleOneOf1Value -> {
            stringResource(R.string.mock_result_pass_paper, number(pass.value.min))
        }

        is SpeakingPassRule.SpeakingPassRuleOneOf2Value -> {
            stringResource(R.string.mock_result_pass_floor, number(pass.value.min))
        }

        is SpeakingPassRule.SpeakingPassRuleOneOf3Value -> {
            null
        }
    }
}
