package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageTodaySpeaking
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.TodayGoal

/** Reads only what the goal's kind can offer, and only where the section shows. */
@Composable
internal fun TodayPractice(
    store: TodayStore,
    goal: TodayGoal,
    navigate: (AppRoute) -> Unit,
) {
    val mistakes by store.mistakes[goal.id].collectShown()
    val mocks =
        if (goal.kind == TodayGoal.Kind.EXAM) {
            store.mocks[goal.id]
                .collectShown()
                .value.value
        } else {
            null
        }
    val speaking =
        if (goal.kind == TodayGoal.Kind.LANGUAGE) {
            store.language[goal.id]
                .collectShown()
                .value.value
                ?.speaking
        } else {
            null
        }

    TodayPracticeRows(mistakes.value, mocks, speaking, navigate)
}

@Composable
internal fun TodayPracticeRows(
    mistakes: MistakeListAvailability?,
    mocks: MockOptions?,
    speaking: LanguageTodaySpeaking?,
    navigate: (AppRoute) -> Unit,
) {
    val mock = mocks?.takeIf { it.running != null || it.options.isNotEmpty() }
    val ready = mistakes?.ready?.toInt() ?: 0
    val tomorrow = mistakes?.tomorrow?.toInt() ?: 0
    if (mock == null && speaking == null && ready + tomorrow == 0) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.today_practice_anytime),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Column {
            mock?.let { MockRow(it, navigate) }
            speaking?.let { SpeakingRow(it, navigate) }
            if (ready + tomorrow > 0) MistakesRow(ready, tomorrow, navigate)
        }
    }
}

@Composable
private fun MockRow(
    mocks: MockOptions,
    navigate: (AppRoute) -> Unit,
) {
    val running = mocks.running

    if (running != null) {
        PracticeRow(
            kind = LearnKind.Mock,
            title = stringResource(R.string.today_continue_mock),
            description = stringResource(R.string.today_continue_mock_detail),
        ) { navigate(AppRoute.Mock(running.id.toString())) }
        return
    }

    val bySubject = mocks.options.any { it.kind == MockOption.Kind.AREA }
    PracticeRow(
        kind = LearnKind.Mock,
        title = stringResource(R.string.today_take_mock),
        description = stringResource(if (bySubject) R.string.today_take_mock_detail_by_subject else R.string.today_take_mock_detail),
        trailing = { if (mocks.access == MockOptions.Access.PLUS_REQUIRED) PlusMark() },
    ) { navigate(AppRoute.MockChooser) }
}

@Composable
private fun SpeakingRow(
    speaking: LanguageTodaySpeaking,
    navigate: (AppRoute) -> Unit,
) {
    PracticeRow(
        kind = LearnKind.Conversation,
        title = stringResource(R.string.today_exam_speaking),
        description = stringResource(R.string.today_exam_speaking_detail, speaking.title),
        trailing = { if (speaking.access == LanguageTodaySpeaking.Access.PLUS_REQUIRED) PlusMark() },
    ) { navigate(AppRoute.Speaking) }
}

@Composable
private fun MistakesRow(
    ready: Int,
    tomorrow: Int,
    navigate: (AppRoute) -> Unit,
) {
    val description =
        when {
            ready > 0 && tomorrow > 0 -> {
                listOf(
                    pluralStringResource(R.plurals.today_mistakes_ready, ready, ready),
                    pluralStringResource(R.plurals.today_mistakes_tomorrow, tomorrow, tomorrow),
                ).joinToString(" · ")
            }

            ready > 0 -> {
                stringResource(R.string.today_mistakes_redo)
            }

            else -> {
                stringResource(R.string.today_mistakes_return_tomorrow)
            }
        }
    val count = if (ready > 0) ready else tomorrow
    val countLabel =
        if (ready > 0) {
            pluralStringResource(R.plurals.today_mistakes_ready, ready, ready)
        } else {
            pluralStringResource(R.plurals.today_mistakes_tomorrow, tomorrow, tomorrow)
        }

    PracticeRow(
        kind = LearnKind.Mistakes,
        title = stringResource(R.string.today_mistakes_notebook),
        description = description,
        trailing = {
            Text(
                text = formatNumber(count.toDouble(), currentLocale()),
                modifier = Modifier.semantics { contentDescription = countLabel },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelLarge.withTabularFigures(),
            )
        },
    ) { navigate(AppRoute.Mistakes) }
}

@Composable
private fun PracticeRow(
    kind: LearnKind,
    title: String,
    description: String,
    trailing: @Composable () -> Unit = {},
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onClick)
                .heightIn(min = 48.dp)
                .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RowMark { KindDot(kind) }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
        trailing()
    }
}
