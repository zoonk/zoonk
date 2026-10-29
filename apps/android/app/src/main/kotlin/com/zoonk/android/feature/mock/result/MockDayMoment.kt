package com.zoonk.android.feature.mock.result

import androidx.compose.runtime.Composable
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.MockExamReached
import com.zoonk.api.models.StudyMissionMoment

/**
 * Where main's `DayMoment` goes on a mock's result: the day's missions it completed and the belt or
 * Energy it reached, celebrated under the result's `CelebrationScope`. The session lane's moment
 * renders here once it lands; until then this shows nothing.
 */
@Composable
@Suppress("UNUSED_PARAMETER")
internal fun MockDayMoment(
    ceremony: Milestone?,
    missionMoment: StudyMissionMoment?,
    reached: MockExamReached,
) = Unit
