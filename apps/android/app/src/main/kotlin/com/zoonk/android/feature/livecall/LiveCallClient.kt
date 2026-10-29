package com.zoonk.android.feature.livecall

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.LanguageConversationConnectInput
import com.zoonk.api.models.LanguageConversationObjectiveCheckInput
import com.zoonk.api.models.LanguageConversationSetup
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LiveCallEndResponse
import com.zoonk.api.models.LiveCallSdpInput
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** What a call asks the server. */
interface LiveCallClient {
    /** Reserves the call; [takeover] ends the learner's other open call first. */
    suspend fun connect(takeover: Boolean): CallReservation

    /** The server's SDP answer to [offer]; it creates the session with its own model, instructions and voice. */
    suspend fun redeem(
        connectionId: UUID,
        offer: String,
    ): String

    /** Has the server hang up: whether it already had at the call's deadline, null if unconfirmed. */
    suspend fun end(connectionId: UUID): Boolean?

    /** Every goal met so far, from what was said; null when the check didn't run. */
    suspend fun checkObjectives(turns: List<LanguageConversationTurn>): List<String>?
}

/** Mirrors main's `readConnectionRefusal`. A [Limit] is always [Limit.Reached] with a period. */
sealed interface CallReservation {
    data class Ready(
        val setup: LanguageConversationSetup,
    ) : CallReservation

    data class Limited(
        val limit: Limit.Reached,
    ) : CallReservation

    data object CallInProgress : CallReservation

    data object CallsPaused : CallReservation

    data object Ended : CallReservation

    data object PlusRequired : CallReservation

    data object PreviousConnectionClosing : CallReservation

    data object Failed : CallReservation

    companion object {
        fun refused(
            code: String?,
            details: JsonElement?,
        ): CallReservation {
            val period = details.field("period")
            return when (code) {
                "CALLS_PAUSED" -> {
                    CallsPaused
                }

                "CALL_IN_PROGRESS" -> {
                    CallInProgress
                }

                "PREVIOUS_CONNECTION_CLOSING" -> {
                    PreviousConnectionClosing
                }

                "PLUS_REQUIRED" -> {
                    PlusRequired
                }

                "CONVERSATION_ENDED" -> {
                    Ended
                }

                "CONVERSATION_LIMIT_REACHED" -> {
                    val limitPeriod = LimitPeriod.entries.firstOrNull { it.name.equals(period, ignoreCase = true) }
                    val tier = LimitTier.entries.firstOrNull { it.name.equals(details.field("tier"), ignoreCase = true) }
                    if (limitPeriod != null && tier != null) Limited(Limit.Reached(tier, limitPeriod)) else Failed
                }

                "CONNECTION_LIMIT_REACHED" -> {
                    if (period == "conversation") Ended else Limited(Limit.Reached(LimitTier.Plus, LimitPeriod.Day))
                }

                "SIGN_UP_REQUIRED" -> {
                    Limited(Limit.Reached(LimitTier.Guest, LimitPeriod.Total))
                }

                else -> {
                    Failed
                }
            }
        }

        private fun JsonElement?.field(name: String) = ((this as? JsonObject)?.get(name) as? JsonPrimitive)?.contentOrNull
    }
}

/**
 * The call's requests for [conversationId]. Each runs under the current session through the cache,
 * except hanging up, which is cleanup: it goes out under the learner who reserved the call, even if
 * the session changed since, so the server stops the call's time.
 */
class LiveConversationCalls(
    private val conversationId: UUID,
    private val api: ApiClients,
    private val cache: AppCache,
) : LiveCallClient {
    private var owner: AuthenticatedSession? = null

    override suspend fun connect(takeover: Boolean): CallReservation {
        // The call holds the plan's call time from its reservation.
        val reservation =
            cache.mutate(invalidating = setOf(DataDomain.Allowance)) { session ->
                owner = session
                perform {
                    api.clients(session).language.connectLanguageConversation(conversationId, LanguageConversationConnectInput(takeover))
                }
            }
        return when (reservation) {
            is MutationResult.Done -> CallReservation.Ready(reservation.value)
            is MutationResult.Failed -> CallReservation.refused(reservation.code, reservation.details)
            MutationResult.Obsolete -> CallReservation.Failed
        }
    }

    override suspend fun redeem(
        connectionId: UUID,
        offer: String,
    ): String {
        val answer =
            cache.mutate { session ->
                perform {
                    api
                        .clients(
                            session,
                        ).language
                        .redeemLanguageConversationSdp(conversationId, connectionId, LiveCallSdpInput(offer))
                }
            }
        return (answer as? MutationResult.Done)?.value?.sdp ?: throw IllegalStateException("The call's answer didn't come")
    }

    override suspend fun end(connectionId: UUID): Boolean? {
        val session = owner ?: return null
        return try {
            val ended = perform { api.clients(session).language.endLanguageConversationConnection(conversationId, connectionId) }
            cache.invalidate(setOf(DataDomain.Allowance))
            ended.endReason == LiveCallEndResponse.EndReason.DEADLINE
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun checkObjectives(turns: List<LanguageConversationTurn>): List<String>? {
        val met =
            cache.mutate { session ->
                perform {
                    api.clients(session).language.checkLanguageConversationObjectives(
                        conversationId,
                        LanguageConversationObjectiveCheckInput(turns),
                    )
                }
            }
        return (met as? MutationResult.Done)?.value?.objectivesMet
    }
}
