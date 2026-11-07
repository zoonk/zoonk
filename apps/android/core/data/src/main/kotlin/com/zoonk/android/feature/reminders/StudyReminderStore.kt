package com.zoonk.android.feature.reminders

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.api.models.PushPlatform
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderUpdate

interface StudyReminderApi {
    suspend fun reminder(session: AuthenticatedSession): StudyReminder

    suspend fun update(
        session: AuthenticatedSession,
        update: StudyReminderUpdate,
    ): StudyReminder

    /** False when the offer was already shown somewhere else. */
    suspend fun claimOffer(
        session: AuthenticatedSession,
        claim: StudyReminderOfferClaim,
    ): Boolean

    suspend fun selectPhone(
        session: AuthenticatedSession,
        phone: StudyReminderPhone,
    ): StudyReminder

    suspend fun removePhone(
        session: AuthenticatedSession,
        token: String,
    ): StudyReminder
}

class LiveStudyReminderApi(
    private val api: ApiClients,
) : StudyReminderApi {
    override suspend fun reminder(session: AuthenticatedSession): StudyReminder =
        perform { api.clients(session).account.getCurrentUserStudyReminder() }.reminder

    override suspend fun update(
        session: AuthenticatedSession,
        update: StudyReminderUpdate,
    ): StudyReminder = perform { api.clients(session).account.updateCurrentUserStudyReminder(update) }.reminder

    override suspend fun claimOffer(
        session: AuthenticatedSession,
        claim: StudyReminderOfferClaim,
    ): Boolean = perform { api.clients(session).account.claimCurrentUserStudyReminderOffer(claim) }.claimed

    override suspend fun selectPhone(
        session: AuthenticatedSession,
        phone: StudyReminderPhone,
    ): StudyReminder = perform { api.clients(session).account.selectCurrentUserStudyReminderPhone(phone) }.reminder

    override suspend fun removePhone(
        session: AuthenticatedSession,
        token: String,
    ): StudyReminder = perform { api.clients(session).account.removeCurrentUserStudyReminderPhone(token) }.reminder
}

/** Where this installation gets pushes: FCM's token for it, once push was set up here. */
interface PushAddress {
    /** Null until push was set up on this installation. */
    val token: String?

    /** The phone's name, as the learner knows it. */
    val label: String

    /** Sets up push here and returns the token; null when it can't (no Firebase configuration, offline). */
    suspend fun register(): String?
}

/** One reminder a day, by email and by push to one phone. Every write sends the app's [language]. */
class StudyReminderStore(
    private val api: StudyReminderApi,
    private val cache: AppCache,
    private val push: PushAddress,
    private val language: () -> String,
) {
    val reminder: Resource<StudyReminder> =
        cache.resource(Audience.SignedIn, DOMAINS) { session -> session?.let { api.reminder(it) } }

    fun isThisPhone(reminder: StudyReminder): Boolean = push.token != null && reminder.push.phone?.token == push.token

    suspend fun claimOffer(): MutationResult<Boolean> =
        cache.mutate(invalidating = setOf(DataDomain.StudyReminder)) { session ->
            val locale = StudyReminderOfferClaim.Locale.entries.firstOrNull { it.value == language() } ?: StudyReminderOfferClaim.Locale.EN
            api.claimOffer(session, StudyReminderOfferClaim(locale))
        }

    /** Changes only what it's given. */
    suspend fun update(
        time: String? = null,
        emailOn: Boolean? = null,
        pushOn: Boolean? = null,
    ): MutationResult<StudyReminder> =
        save { session ->
            val locale = StudyReminderUpdate.Locale.entries.firstOrNull { it.value == language() } ?: StudyReminderUpdate.Locale.EN
            api.update(session, StudyReminderUpdate(locale, emailOn = emailOn, pushOn = pushOn, time = time))
        }

    /** Push goes to this phone from now on; whether it's on doesn't change. Ask for notifications first. */
    suspend fun useThisPhone(): MutationResult<StudyReminder> {
        val token = push.register() ?: return MutationResult.Failed(ApiError.Unavailable)
        return save { session -> api.selectPhone(session, phone(token)) }
    }

    /** "Remind me": this phone, then push on at [time]. Done only once both saved. */
    suspend fun turnOnPush(time: String? = null): MutationResult<StudyReminder> {
        val selected = useThisPhone()
        if (selected !is MutationResult.Done) return selected
        return update(time = time, pushOn = true)
    }

    /** Before [session] signs out: this phone stops getting its reminders, if it's the one they go to. */
    suspend fun leave(session: AuthenticatedSession) {
        push.token?.let { api.removePhone(session, it) }
    }

    /** FCM gave this installation [token] in place of [previous]: when that was the learner's phone, so is this. */
    suspend fun follow(
        previous: String,
        token: String,
    ) {
        cache.mutate(
            invalidating = setOf(DataDomain.StudyReminder),
            replacing = { saved: StudyReminder? -> listOfNotNull(saved?.let(reminder::replacing)) },
        ) { session ->
            if (api
                    .reminder(session)
                    .push.phone
                    ?.token == previous
            ) {
                api.selectPhone(session, phone(token))
            } else {
                null
            }
        }
    }

    private fun phone(token: String): StudyReminderPhone {
        val locale = StudyReminderPhone.Locale.entries.firstOrNull { it.value == language() } ?: StudyReminderPhone.Locale.EN
        return StudyReminderPhone(push.label.take(MAX_LABEL_LENGTH), locale, PushPlatform.ANDROID, token)
    }

    private suspend fun save(write: suspend (AuthenticatedSession) -> StudyReminder): MutationResult<StudyReminder> =
        cache.mutate(invalidating = setOf(DataDomain.StudyReminder), replacing = { listOf(reminder.replacing(it)) }, write = write)

    companion object {
        /** What the read is built from: the reminder, the active goal's zone and study time, and the email. */
        private val DOMAINS = setOf(DataDomain.StudyReminder, DataDomain.Goals, DataDomain.LearningProfile, DataDomain.UserProgress)

        private const val MAX_LABEL_LENGTH = 100
    }
}
