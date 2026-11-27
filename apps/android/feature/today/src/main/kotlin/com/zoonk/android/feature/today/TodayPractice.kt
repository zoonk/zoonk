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
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.listRowDescription
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.LanguageTodaySpeaking
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockOptions
import java.util.UUID

/** Reads only what the goal's kind can offer, and only where the section shows. */
@Composable
internal fun TodayPractice(
    store: TodayStore,
    mocks: MockStore,
    goalId: UUID,
    isExam: Boolean,
    isLanguage: Boolean,
    completedLessons: Boolean,
    navigate: (AppRoute) -> Unit,
) {
    val mistakes by store.mistakes[goalId].collectShown()
    val mocks =
        if (isExam) {
            mocks.options[goalId]
                .collectShown()
                .value.value
        } else {
            null
        }
    val speaking =
        if (isLanguage) {
            store.language[goalId]
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
    if (mock == null && speaking == null && ready == 0 && !completedLessons) return

    val rows =
        buildList<@Composable () -> Unit> {
            mock?.let { add { MockRow(it, navigate) } }
            speaking?.let { add { SpeakingRow(it, navigate) } }
            if (ready > 0) add { MistakesRow(ready, navigate) }
            if (completedLessons) {
                add {
                    PracticeRow(
                        kind = LearnKind.Lesson,
                        title = stringResource(R.string.navigation_completed_lessons),
                        description = stringResource(R.string.today_completed_lessons_line),
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
    ) { navigate(AppRoute.Speaking()) }
}

@Composable
private fun MistakesRow(
    ready: Int,
    navigate: (AppRoute) -> Unit,
) {
    val countLabel = pluralStringResource(R.plurals.today_mistakes_ready, ready, ready)

    PracticeRow(
        kind = LearnKind.Mistakes,
        title = stringResource(R.string.today_mistakes_notebook),
        description = stringResource(R.string.today_mistakes_redo),
        trailing = {
            Text(
                text = formatNumber(ready.toDouble(), currentLocale()),
                modifier = Modifier.semantics { contentDescription = countLabel },
            )
        },
    ) { navigate(AppRoute.Mistakes) }
}

@Composable
private fun PracticeRow(
    kind: LearnKind,
    title: String,
    description: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    ListRow(
        headline = { Text(title) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = onClick,
        leading = { KindMark(kind) },
        supporting = listRowDescription(description),
        meta = trailing,
    )
}
