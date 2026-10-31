package com.zoonk.android.feature.account

import android.content.Context
import androidx.core.content.edit
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.SignOutResult
import com.zoonk.android.data.value
import com.zoonk.api.models.LearnerSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration.Companion.hours

sealed interface BirthYearPrompt {
    /** [canClose] while a visitor hasn't started anything: closing it cancels the tap that asked. */
    data class Question(
        val canClose: Boolean,
        val saving: Boolean,
        val error: BirthYearError?,
    ) : BirthYearPrompt

    /** [logsOut] for a signed-in account, which its OK logs out; a visitor's OK only closes it. */
    data class BelowMinimumAge(
        val minimumAge: Int,
        val logsOut: Boolean,
    ) : BirthYearPrompt

    /** The server deleted the account, so its OK forgets the session on this device. */
    data class AccountClosed(
        val minimumAge: Int,
    ) : BirthYearPrompt
}

enum class BirthYearError { Invalid, NotSaved }

/** A below-minimum answer on this device, at [at] epoch milliseconds. */
data class AgeStop(
    val minimumAge: Int,
    val at: Long,
)

interface AgeStops {
    fun last(): AgeStop?

    fun remember(stop: AgeStop)
}

class PreferencesAgeStops(
    context: Context,
) : AgeStops {
    private val preferences = context.getSharedPreferences("age_stop", Context.MODE_PRIVATE)

    override fun last(): AgeStop? =
        if (preferences.contains(AT)) AgeStop(preferences.getInt(MINIMUM_AGE, 0), preferences.getLong(AT, 0)) else null

    override fun remember(stop: AgeStop) =
        preferences.edit {
            putInt(MINIMUM_AGE, stop.minimumAge)
            putLong(AT, stop.at)
        }

    private companion object {
        const val MINIMUM_AGE = "minimum_age"
        const val AT = "at"
    }
}

/**
 * Asks every account's birth year once, before it keeps learning: a visitor's first write waits for
 * it before starting a guest, and a signed-in account whose summary still needs it is asked over
 * every screen. The server decides the minimum age: a visitor below it never gets a guest, an
 * account below it is logged out, and for a day this device shows that message instead of the
 * question.
 */
class BirthYearGate(
    private val sessions: SessionStore,
    private val summary: Resource<LearnerSummary>,
    private val checkAge: suspend (birthYear: Long) -> Unit,
    private val startGuestSession: suspend () -> SignInResult,
    private val saveBirthYear: suspend (Long) -> MutationResult<*>,
    private val stops: AgeStops,
    private val onSignOutFailed: () -> Unit,
    private val scope: CoroutineScope,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private data class Form(
        val saving: Boolean = false,
        val error: BirthYearError? = null,
    )

    private sealed interface Visitor {
        class Asking(
            val answers: Channel<Long>,
        ) : Visitor

        data class Stopped(
            val minimumAge: Int,
        ) : Visitor
    }

    private data class ClosedAccount(
        val session: AuthenticatedSession,
        val minimumAge: Int,
    )

    private val form = MutableStateFlow(Form())
    private val visitor = MutableStateFlow<Visitor?>(null)
    private val lastStop = MutableStateFlow(stops.last())

    /** Kept until OK, even once a request finds its session gone. */
    private val closedAccount = MutableStateFlow<ClosedAccount?>(null)

    val prompt: StateFlow<BirthYearPrompt?> =
        combine(sessions.state, summary.state, visitor, form, lastStop) { session, summary, visitor, form, lastStop ->
            when {
                visitor is Visitor.Stopped -> {
                    BirthYearPrompt.BelowMinimumAge(visitor.minimumAge, logsOut = false)
                }

                visitor is Visitor.Asking -> {
                    form.question(canClose = session !is SessionState.SignedIn && !form.saving)
                }

                session is SessionState.SignedIn && summary.value?.needsBirthYear == true -> {
                    lastStop?.takeIf(::isActive)?.let { BirthYearPrompt.BelowMinimumAge(it.minimumAge, logsOut = true) }
                        ?: form.question(canClose = false)
                }

                else -> {
                    null
                }
            }
        }.combine(closedAccount) { prompt, closed -> closed?.let { BirthYearPrompt.AccountClosed(it.minimumAge) } ?: prompt }
            .stateIn(scope, SharingStarted.Eagerly, null)

    /**
     * For a visitor's first write: asks the year and checks it, then starts the guest and saves the
     * year as that guest. [SignInResult.Obsolete] when the write shouldn't go on: the visitor closed
     * the question, is below the minimum age, or another session took over.
     */
    suspend fun startGuest(): SignInResult {
        lastStop.value?.takeIf(::isActive)?.let {
            visitor.value = Visitor.Stopped(it.minimumAge)
            return SignInResult.Obsolete
        }
        val asking = Visitor.Asking(Channel(Channel.CONFLATED))
        (visitor.value as? Visitor.Asking)?.answers?.close()
        visitor.value = asking
        try {
            for (birthYear in asking.answers) {
                // The screen that asked can go as soon as the guest starts (a lesson opens), so the year is saved regardless.
                withContext(NonCancellable) { startWith(birthYear) }?.let { return it }
            }
            return SignInResult.Obsolete
        } finally {
            if (visitor.value === asking) {
                visitor.value = null
                form.value = Form()
            }
        }
    }

    fun answer(birthYear: Long) {
        if (form.value.saving) return
        form.value = Form(saving = true)
        val asking = visitor.value as? Visitor.Asking
        if (asking != null) {
            asking.answers.trySend(birthYear)
        } else {
            scope.launch { save(birthYear) }
        }
    }

    /** The visitor closed the question without answering. */
    fun close() {
        (visitor.value as? Visitor.Asking)?.answers?.close()
    }

    fun closeBelowMinimumAge() {
        val shown = prompt.value as? BirthYearPrompt.BelowMinimumAge ?: return
        if (!shown.logsOut) {
            visitor.value = null
            return
        }
        scope.launch { if (sessions.signOut() is SignOutResult.Failed) onSignOutFailed() }
    }

    /** Its server session no longer exists, so it's only forgotten on this device. */
    fun forgetClosedAccount() {
        val closed = closedAccount.value ?: return
        scope.launch {
            sessions.forgetDeletedAccount(closed.session)
            closedAccount.value = null
        }
    }

    /** Null asks again. */
    private suspend fun startWith(birthYear: Long): SignInResult? {
        if (sessions.current == null) {
            try {
                checkAge(birthYear)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val refusal = e as? ApiException
                val minimumAge = refuse(refusal?.code, refusal?.details) ?: return null
                visitor.value = Visitor.Stopped(minimumAge)
                return SignInResult.Obsolete
            }
            val started = startGuestSession()
            if (started != SignInResult.SignedIn) return started
        }
        return when (save(birthYear)) {
            Saved.Done -> SignInResult.SignedIn
            Saved.Stopped, Saved.Obsolete -> SignInResult.Obsolete
            Saved.Retry -> null
        }
    }

    private enum class Saved { Done, Stopped, Retry, Obsolete }

    /** Below the minimum age the account stays signed in until its message's OK logs it out. */
    private suspend fun save(birthYear: Long): Saved =
        when (val result = saveBirthYear(birthYear)) {
            is MutationResult.Done -> {
                summary.update { it.copy(needsBirthYear = false) }
                form.value = Form()
                Saved.Done
            }

            is MutationResult.Failed -> {
                val minimumAge = refuse(result.code, result.details)
                val session = sessions.current
                if (minimumAge != null && session != null && result.details.accountClosed()) {
                    closedAccount.value = ClosedAccount(session, minimumAge)
                }
                if (minimumAge != null) Saved.Stopped else Saved.Retry
            }

            MutationResult.Obsolete -> {
                form.value = Form()
                Saved.Obsolete
            }
        }

    /** Shows why the year was refused; the minimum age when the learner is below it, which this device then remembers. */
    private fun refuse(
        code: String?,
        details: JsonElement?,
    ): Int? {
        val minimumAge = if (code == "BELOW_MINIMUM_AGE") details.minimumAge() else null
        if (minimumAge != null) {
            val stop = AgeStop(minimumAge, now())
            stops.remember(stop)
            lastStop.value = stop
        }
        form.value =
            when {
                minimumAge != null -> Form()
                code == "INVALID_BIRTH_YEAR" -> Form(error = BirthYearError.Invalid)
                else -> Form(error = BirthYearError.NotSaved)
            }
        return minimumAge
    }

    private fun isActive(stop: AgeStop) = now() - stop.at in 0 until STOP_KEPT.inWholeMilliseconds

    private fun Form.question(canClose: Boolean) = BirthYearPrompt.Question(canClose, saving, error)

    private fun JsonElement?.minimumAge(): Int = (((this as? JsonObject)?.get("minimumAge")) as? JsonPrimitive)?.intOrNull ?: MINIMUM_AGE

    private fun JsonElement?.accountClosed(): Boolean =
        (((this as? JsonObject)?.get("accountClosed")) as? JsonPrimitive)?.booleanOrNull == true

    private companion object {
        val STOP_KEPT = 24.hours

        /** The Terms' minimum where no country sets another, for a refusal without its details. */
        const val MINIMUM_AGE = 13
    }
}
