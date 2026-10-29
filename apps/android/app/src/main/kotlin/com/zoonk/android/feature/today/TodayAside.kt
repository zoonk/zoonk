package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.zoonk.android.feature.missions.MissionsCard
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MistakeListAvailability

/** What the aside needs beyond the day: values the screen reads, and where its rows lead. */
internal class TodayAsideState(
    val buddy: BuddyLook,
    val buddyName: String,
    val brainPower: Long?,
    val mistakes: MistakeListAvailability?,
    val onMission: (MissionOpens) -> Unit,
    val navigate: (AppRoute) -> Unit,
)

/** The week's side of Today: missions, the week, then the ways to practice anytime. */
@Composable
internal fun TodayAside(
    model: TodayDayModel,
    aside: TodayAsideState,
    beside: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(32.dp)) {
        MissionsCard(
            missions = model.day.missions,
            fullMeal = model.day.fullMeal,
            buddy = aside.buddy,
            buddyName = aside.buddyName,
            onOpen = aside.onMission,
            brainPower = aside.brainPower,
            blockOf = { mission -> model.blockOf(mission) },
            // Where the queue sits right above, it marks each mission's block and the card keeps only its status.
            rowsInQueue = !beside && model.day.missions.onlyOpenBlocks(),
            collapseWhenDone = true,
        )
        TodayWeek(model.day, model.today.weeklyChallenge, aside.navigate)
        // Beside the page, the drawer's Study places hold the same ways in.
        if (!beside) TodayPractice(aside.mistakes, aside.navigate)
    }
}

/** The aside beside the page, scrolled on its own. */
@Composable
internal fun TodayAsidePane(
    model: TodayDayModel,
    aside: TodayAsideState,
) {
    TodayAside(
        model,
        aside,
        beside = true,
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 24.dp),
    )
}

internal fun TodayDayModel.blockOf(mission: DayMission): DayStep? {
    val opens = mission.opens as? MissionOpens.Block ?: return null
    return day.steps.firstOrNull { if (opens.blockId != null) it.id == opens.blockId else it.position == opens.position }
}

private fun List<DayMission>.onlyOpenBlocks(): Boolean =
    all {
        it.done ||
            (it.opens is MissionOpens.Block && it.waitReason == null && it.total <= 1)
    }

@Composable
private fun TodayPractice(
    mistakes: MistakeListAvailability?,
    navigate: (AppRoute) -> Unit,
) {
    val ready = mistakes?.ready?.toInt() ?: 0
    val tomorrow = mistakes?.tomorrow?.toInt() ?: 0
    if (ready + tomorrow == 0) return

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
        if (ready >
            0
        ) {
            pluralStringResource(R.plurals.today_mistakes_ready, ready, ready)
        } else {
            pluralStringResource(R.plurals.today_mistakes_tomorrow, tomorrow, tomorrow)
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.today_practice_anytime),
            modifier =
                Modifier.semantics {
                    heading()
                },
            style = MaterialTheme.typography.titleMedium,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button) { navigate(AppRoute.Mistakes) }
                    .heightIn(min = 48.dp)
                    .padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RowMark { KindDot(LearnKind.Mistakes) }
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.today_mistakes_notebook), style = MaterialTheme.typography.titleSmall)
                Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
            Text(
                text = formatNumber(count.toDouble(), currentLocale()),
                modifier = Modifier.semantics { contentDescription = countLabel },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelLarge.withTabularFigures(),
            )
        }
    }
}
