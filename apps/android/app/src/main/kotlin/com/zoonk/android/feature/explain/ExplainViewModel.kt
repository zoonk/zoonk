package com.zoonk.android.feature.explain

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.api.models.Explanation
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException

/**
 * A quick explanation's writing, for the learner who opened it: its run is followed while it's
 * written, and only a tap writes it again.
 */
class ExplainViewModel(
    private val goalId: String,
    private val store: ExplainStore,
    private val cache: AppCache,
    private val sessions: SessionSource,
    private val generations: (AuthenticatedSession?) -> GenerationSource,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private var owner: AuthenticatedSession? = null
    private var followed: String? = null
    private var startedAt: Long? = null

    private val follower =
        GenerationFollower(
            kind = GenerationKind.Explanation,
            scope = viewModelScope,
            source =
                object : GenerationSource {
                    override fun events(id: String) = generations(owner).events(id)

                    override suspend fun status(id: String) = generations(owner).status(id)
                },
            restart = { writeAgain() },
        )

    val run: StateFlow<GenerationRun> = follower.run

    /** Follows the run writing [explanation] while it has no lesson; another session starts over. */
    fun show(explanation: Explanation) {
        val session = sessions.current

        if (session != owner) {
            follower.stop()
            owner = session
            followed = null
            startedAt = null
        }

        if (explanation.lesson != null) return

        startedAt = startedAt ?: now()
        val generationId = explanation.generationId
        if (generationId != null && generationId != followed) {
            followed = generationId
            follower.follow(generationId)
        }
    }

    fun retry() = follower.retry()

    /** Main's "Try again" on a slow wait: false when it couldn't start. */
    suspend fun retrySlow(explanation: Explanation): Boolean {
        if (explanation.status != Explanation.Status.PREPARING) return true
        val generationId =
            try {
                writeAgain()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                return false
            }
        followed = generationId
        follower.follow(generationId)
        return true
    }

    /** Once, when the written explanation shows after a wait. */
    fun recordWait() {
        val began = startedAt ?: return
        val session = owner
        startedAt = null
        viewModelScope.launch {
            cache.mutate { current -> if (current == session) store.api.recordWait(current, now() - began) }
        }
    }

    private suspend fun writeAgain(): String {
        val session = owner
        val result = cache.mutate { current -> if (current == session) store.api.writeAgain(current, goalId) else null }
        return (result as? MutationResult.Done)?.value ?: error("The explanation couldn't be written again")
    }
}
