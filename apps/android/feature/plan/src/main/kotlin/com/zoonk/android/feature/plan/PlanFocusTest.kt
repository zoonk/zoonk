package com.zoonk.android.feature.plan

import com.zoonk.android.ui.components.textInset
import com.zoonk.android.ui.components.LocalButtonSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.focustest.FocusTestStore
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowWordsStart
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.FocusTestControlsInput
import com.zoonk.api.models.FocusTestSessionQuestions
import com.zoonk.api.models.FocusTestSummary
import com.zoonk.api.models.FocusTestSummaryOffer
import com.zoonk.api.models.Plan
import kotlinx.coroutines.launch
import java.util.UUID

/** "Pause test questions" and "Ask them again": the test's questions inside sessions. */
class PlanFocusTestModel(
    private val store: FocusTestStore,
    private val goalId: UUID,
) : ViewModel() {
    var saving by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    fun setQuestions(on: Boolean) {
        if (saving) return
        saving = true
        failed = false
        viewModelScope.launch {
            val questions = if (on) FocusTestControlsInput.SessionQuestions.ON else FocusTestControlsInput.SessionQuestions.PAUSED
            failed = store.setSessionQuestions(goalId, questions) is MutationResult.Failed
            saving = false
        }
    }
}

/** The test's first sitting, for a learner who hasn't started it and whose time doesn't cover everything: where a focus would help most. */
fun focusTestOffer(plan: Plan): FocusTestSummaryOffer? =
    plan.focusTest
        ?.takeIf { it.state == FocusTestSummary.State.NOT_STARTED && planCoverage(plan) != null }
        ?.offer

@Composable
fun checkFocusLabel(minutes: Int): String = stringResource(R.string.focustest_check_where_to_focus, formatMinutes(minutes, currentLocale()))

/** The test's state as a row's facts: "Not started", "Continue" with what's left, or its last result. */
@Composable
internal fun focusTestFacts(summary: FocusTestSummary): String {
    val offer = summary.offer
    val about = offer?.let { stringResource(R.string.focustest_about, formatMinutes(it.minutes.toInt(), currentLocale())) }

    return when {
        summary.state == FocusTestSummary.State.NOT_STARTED -> {
            factsLine(stringResource(R.string.focustest_not_started), about)
        }

        summary.state == FocusTestSummary.State.SITTING && offer != null -> {
            val left = offer.questions.toInt()
            factsLine(stringResource(R.string.focustest_continue), pluralStringResource(R.plurals.focustest_questions_left, left, left))
        }

        else -> {
            val result =
                summary.subjects?.let {
                    pluralStringResource(R.plurals.focustest_result_subjects, it.total.toInt(), it.asked.toInt(), it.total.toInt())
                } ?: stringResource(R.string.focustest_answers_in_plan)
            val more = offer?.let { pluralStringResource(R.plurals.focustest_more_questions, it.questions.toInt(), it.questions.toInt()) }
            factsLine(result, more)
        }
    }
}

/** The Focus test's place on the plan: its state, a way in, and its questions' switch. */
@Composable
internal fun PlanFocusTestRow(
    summary: FocusTestSummary,
    onOpen: () -> Unit,
    model: PlanFocusTestModel?,
) {
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        ListRow(
            headline = { Text(stringResource(R.string.focustest_title)) },
            onClick = onOpen,
            leading = { Icon(painterResource(R.drawable.ic_my_location), contentDescription = null) },
            supporting = { Text(focusTestFacts(summary)) },
        )
        if (model != null && summary.sessionQuestions != FocusTestSessionQuestions.OFF) {
            TestQuestionsSwitch(summary.sessionQuestions == FocusTestSessionQuestions.PAUSED, model)
        }
    }
}

/** Said only while sessions ask the test's questions, or the learner paused them. */
@Composable
private fun TestQuestionsSwitch(
    paused: Boolean,
    model: PlanFocusTestModel,
) {
    Column(Modifier.padding(start = listRowWordsStart()), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            stringResource(if (paused) R.string.focustest_session_questions_paused else R.string.focustest_session_questions_on),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        TextButton(onClick = { model.setQuestions(on = paused) }, busy = model.saving, modifier = Modifier.bleed(LocalButtonSize.current.textInset)) {
            Text(stringResource(if (paused) R.string.focustest_ask_again else R.string.focustest_pause_questions))
        }
        if (model.failed) {
            Text(
                stringResource(R.string.plan_save_failed),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
