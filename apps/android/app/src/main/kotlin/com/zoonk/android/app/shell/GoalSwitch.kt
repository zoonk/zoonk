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
 * The goal the learner switched to, while the switch is on its way: the tab roots still show the
 * previous goal, so they dim, since a tap on Today's Start would open that goal's session.
 */
class GoalSwitch(
    private val api: GoalSwitchApi,
    private val cache: AppCache,
) {
    private val switching = MutableStateFlow<UUID?>(null)
    val pending: StateFlow<UUID?> = switching.asStateFlow()

    /** Pending until [shown] (the frame's and tab's reads) show the new goal, not only until it's saved. */
    suspend fun select(
        goalId: UUID,
        shown: List<Resource<*>>,
    ) {
        if (switching.value != null) return
        switching.value = goalId

        try {
            val result = cache.mutate(invalidating = setOf(DataDomain.LearningProfile)) { session -> api.makeActive(session, goalId) }
            if (result is MutationResult.Done) coroutineScope { shown.forEach { launch { it.refresh() } } }
        } finally {
            switching.value = null
        }
    }
}
