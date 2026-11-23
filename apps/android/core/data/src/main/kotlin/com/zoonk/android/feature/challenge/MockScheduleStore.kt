package com.zoonk.android.feature.challenge

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.api.models.MockScheduleInput
import kotlinx.datetime.LocalDate
import java.util.UUID
import kotlin.time.Duration

class MockScheduleStore(
    private val api: ApiClients,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    private val domains = setOf(DataDomain.Goals, DataDomain.UserSession, DataDomain.LearnerModel)
    val dates =
        cache.keyed<UUID, List<LocalDate>>(Audience.SignedIn, domains, maxAge = Duration.ZERO) { session, id ->
            session?.let { perform { api.clients(it).studySessions.getMockScheduleDates(id, timeZone()) }.dates }
        }

    data class Change(
        val owner: AuthenticatedSession,
        val itemId: UUID,
        val changeId: UUID,
        val date: LocalDate?,
    )

    private var saved by mutableStateOf<Change?>(null)
    val notice: Change? get() = saved?.takeIf { it.owner == cache.session.current }

    suspend fun change(
        id: UUID,
        date: LocalDate?,
    ): MutationResult<Change> {
        val result =
            cache.mutate(invalidating = domains) { session ->
                val input = MockScheduleInput(date = date, timeZone = timeZone())
                val response = perform { api.clients(session).studySessions.changeMockSchedule(id, input) }
                Change(session, id, response.changeId, date)
            }
        if (result is MutationResult.Done) saved = result.value
        return result
    }

    fun dismiss(change: Change) {
        if (saved == change) saved = null
    }

    suspend fun undo(change: Change): MutationResult<Unit> {
        if (notice != change) return MutationResult.Obsolete
        val result =
            cache.mutate(invalidating = domains) { session ->
                perform { api.clients(session).studySessions.undoMockSchedule(change.itemId, change.changeId, timeZone()) }
            }
        if (result is MutationResult.Done) dismiss(change)
        return result
    }
}
