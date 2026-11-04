package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.LanguageTodaySpeaking
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.TodayGoal

/** Reads only what the goal's kind can offer, and only where the section shows. */
@Composable
internal fun TodayPractice(
    store: TodayStore,
    mocks: MockStore,
    goal: TodayGoal,
    completedLessons: Boolean,
    navigate: (AppRoute) -> Unit,
) {
    val mistakes by store.mistakes[goal.id].collectShown()
    val mocks =
        if (goal.kind == TodayGoal.Kind.EXAM) {
            mocks.options[goal.id]
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

    TodayPracticeRows(mistakes.value?.availability, mocks, speaking, completedLessons, navigate)
}

@Composable
fun TodayPracticeRows(
    mistakes: MistakeListAvailability?,
    mocks: MockOptions?,
    speaking: LanguageTodaySpeaking?,
    completedLessons: Boolean,
    navigate: (AppRoute) -> Unit,
) {
    val mock = mocks?.takeIf { it.running != null || it.options.isNotEmpty() }
    val ready = mistakes?.ready?.toInt() ?: 0
    val tomorrow = mistakes?.tomorrow?.toInt() ?: 0
    if (mock == null && speaking == null && ready + tomorrow == 0 && !completedLessons) return

    val rows =
        buildList<@Composable () -> Unit> {
            mock?.let { add { MockRow(it, navigate) } }
            speaking?.let { add { SpeakingRow(it, navigate) } }
            if (ready + tomorrow > 0) add { MistakesRow(ready, tomorrow, navigate) }
            if (completedLessons) {
                add {
                    PracticeRow(
                        kind = LearnKind.Lesson,
                        title = stringResource(R.string.navigation_completed_lessons),
                        description = stringResource(R.string.today_completed_lessons_detail),
                    ) { navigate(AppRoute.CompletedLessons) }
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.today_practice_anytime))
        Column {
            rows.forEachIndexed { index, row ->
                if (index > 0) HorizontalDivider()
                row()
            }
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
    ) { navigate(AppRoute.Speaking()) }
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
                ).factsLine()
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
            )
        },
    ) { navigate(AppRoute.Mistakes) }
}

@Composable
private fun PracticeRow(
    kind: LearnKind,
    title: String,
    description: String,
    trailing: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    ListRow(
        headline = { Text(title) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = onClick,
        leading = { KindDot(kind) },
        supporting = { Text(description) },
        meta = trailing,
    )
}
