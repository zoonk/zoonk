package com.zoonk.android.feature.today

import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.Today
import kotlinx.datetime.LocalDate
import java.util.UUID

/**
 * One visit to a goal's day: the notice Today named when it opened and the insight it showed, so
 * answering shows what the answer did; the next notice waits for the next visit. The visit opens on
 * Today's first settled read, or on the one whose notice the learner answers, never on the stored day
 * shown while a newer read loads.
 */
data class NoticeHold(
    val goalId: UUID,
    val date: LocalDate,
    val kind: Today.Notice?,
    val insight: MemoryInsight?,
)

fun NoticeHold?.next(
    goalId: UUID,
    date: LocalDate,
    picked: Today.Notice?,
    insight: MemoryInsight?,
    opens: Boolean,
): NoticeHold? {
    val visit = this?.takeIf { it.goalId == goalId && it.date == date }
    if (!opens) return visit
    return NoticeHold(goalId, date, kind = visit?.kind ?: picked, insight = insight ?: visit?.insight)
}
