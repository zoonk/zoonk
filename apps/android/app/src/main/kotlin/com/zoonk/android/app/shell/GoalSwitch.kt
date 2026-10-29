package com.zoonk.android.app.shell

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

fun interface GoalSwitchApi {
    suspend fun makeActive(
        session: AuthenticatedSession,
        goalId: UUID,
    )
}

/**
 * The goal the learner switched to, until the tabs show it: they still show the previous goal
 * meanwhile, and a tap on Today's Start would open that goal's session.
 */
class GoalSwitch(
    private val api: GoalSwitchApi,
    private val cache: AppCache,
) {
    private val target = MutableStateFlow<UUID?>(null)
    private val writing = MutableStateFlow(false)

    val pending: StateFlow<UUID?> = target.asStateFlow()

    /** The switch is being saved; until it is, the tabs can't have read the new goal. */
    val saving: StateFlow<Boolean> = writing.asStateFlow()

    /** [shown] are the reads that show the active goal, read again once it's saved; [shows] says when they do. */
    suspend fun select(
        goalId: UUID,
        shown: List<Resource<*>>,
        shows: (UUID) -> Boolean,
    ) {
        if (writing.value) return
        writing.value = true
        target.value = goalId

        try {
            val result = cache.mutate(invalidating = setOf(DataDomain.LearningProfile)) { session -> api.makeActive(session, goalId) }
            if (result is MutationResult.Done) {
                coroutineScope { shown.forEach { launch { it.refresh() } } }
                if (shows(goalId)) settle(goalId)
            } else {
                settle(goalId)
            }
        } finally {
            writing.value = false
        }
    }

    /** A tab shows [goalId] now (or no goal's day at all), so the switch is over. */
    fun settle(goalId: UUID) {
        target.compareAndSet(goalId, null)
    }
}
