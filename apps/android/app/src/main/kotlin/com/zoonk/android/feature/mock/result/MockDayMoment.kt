package com.zoonk.android.feature.mock.result

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.android.feature.session.missionMomentFacts
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.api.models.MockExam

/** Main's `DayMoment` on a mock's result: the day's missions it finished, then the belt level and Energy it reached. */
@Composable
internal fun MockDayMoment(
    app: AppContainer,
    view: MockExam,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val learnerBuddy = summary.value?.buddy
    val look = learnerBuddy?.look() ?: BuddyLook()

    DayMoment(
        missions = view.missionMoment?.missionMomentFacts(),
        reached = ReachedFacts(view.reached.level, view.reached.energy),
        ceremony = view.ceremony?.kind,
        buddy = look,
        buddyName = buddyName(look.kind, learnerBuddy?.name),
    )
}
