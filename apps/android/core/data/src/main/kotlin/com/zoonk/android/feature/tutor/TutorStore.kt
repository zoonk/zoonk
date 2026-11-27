package com.zoonk.android.feature.tutor

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.value
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.api.models.MemoryChangeReference
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import java.util.UUID

class TutorStore(
    val api: TutorApi,
    val cache: AppCache,
    val sessions: SessionSource,
    val undoMemory: suspend (List<MemoryChangeReference>) -> MutationResult<Unit>,
    val setRegion: suspend (goalId: UUID, region: String?) -> MutationResult<Unit>,
    val setContentCountry: suspend (goalId: UUID, country: String) -> MutationResult<Unit>,
    val setHomeCountry: suspend (CountryChoice) -> Boolean,
    val decidePlanChange: suspend (goalId: UUID, PlanChange, PlanChangeDecisionInput.Status) -> MutationResult<PlanChange>,
) {
    /** Before its first question a conversation reads as an empty thread, so a sent one can be added to it. */
    val threads: KeyedResources<TutorThreadKey, TutorThread> =
        cache.keyed(Audience.SignedIn) { session, key -> api.thread(key, cursor = null, session) ?: TutorThread.Empty }

    /** Each goal's buddy conversations, by goal id; a guest's list is never read. */
    val conversations: KeyedResources<String, BuddyConversationList> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.BuddyConversations)) { session, goalId ->
            session?.let { api.conversations(goalId, cursor = null, it) }
        }

    /** Names a new conversation for [goalId], which its first question creates: until then it's empty, read from nowhere. */
    fun newConversation(goalId: String): String {
        val id = UUID.randomUUID().toString()
        threads[TutorThreadKey.Plan(goalId, id)].replace(TutorThread.Empty)
        return id
    }

    /** Reads the page after [goalId]'s listed conversations into its list; false when it couldn't be read. */
    suspend fun showMoreConversations(goalId: String): Boolean {
        val list = conversations[goalId]
        val cursor =
            list.state.value.value
                ?.nextCursor ?: return true
        val session = sessions.current ?: return true
        val revision = list.revision
        val next =
            try {
                api.conversations(goalId, cursor, session)
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) sessions.expire(session)
                return false
            }
        if (sessions.current == session && list.revision == revision) list.update { it.appending(next) }
        return true
    }

    /** [turn] was asked in [scope]: a buddy conversation moves to the top of its goal's list, or joins it. */
    fun asked(
        scope: TutorScope,
        turn: TutorTurn,
    ) {
        if (scope !is TutorScope.Plan) return
        conversations[scope.goalId].update { it.asked(scope.conversationId, turn.question, turn.createdAt) }
    }
}
