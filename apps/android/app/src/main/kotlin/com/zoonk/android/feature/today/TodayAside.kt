package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.missions.MissionsCard
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.SuggestionLayout

/** What the aside needs beyond the day: values the screen reads, and where its rows lead. */
internal class TodayAsideState(
    val buddy: BuddyLook,
    val buddyName: String,
    val brainPower: Long?,
    val practice: @Composable () -> Unit,
    val notice: @Composable (SuggestionLayout) -> Unit,
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
        if (!beside) aside.notice(SuggestionLayout.Line)
        MissionsCard(
            missions = model.day.missions,
            bonus = model.day.fullMeal.bonus,
            bonusEarned = model.day.fullMeal.earned,
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
        if (beside) aside.notice(SuggestionLayout.Panel)
        // Beside the page, the drawer's Study places hold the same ways in.
        if (!beside) aside.practice()
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
