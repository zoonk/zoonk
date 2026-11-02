package com.zoonk.android.feature.mock.result

import androidx.compose.runtime.Composable
import com.zoonk.android.feature.ceremonies.MomentBuddy
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.android.feature.session.missionMomentFacts
import com.zoonk.api.models.MockExam

/** Main's `DayMoment` on a mock's result: the day's missions it finished, then the belt level and Energy it reached. */
@Composable
internal fun MockDayMoment(
    view: MockExam,
    buddy: MomentBuddy,
) {
    DayMoment(
        missions = view.missionMoment?.missionMomentFacts(),
        reached = ReachedFacts(view.reached.level, view.reached.energy),
        ceremony = view.ceremony?.kind,
        buddy = buddy.look,
        buddyName = buddy.name,
    )
}
