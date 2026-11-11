package com.zoonk.android.feature.reminders

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.perform
import com.zoonk.api.models.PushPlatform
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderUpdate
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

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
}

/** Where this installation gets pushes: FCM's token for it, once push was set up here. */
interface PushAddress {
    /** The token the server last took for this installation; null before that. */
    val token: String?

    /** The phone's name, as the learner knows it. */
    val label: String

    /** Sets up push here and returns FCM's token now; null when it can't (no Firebase configuration, offline). */
    suspend fun register(): String?

    /** The server took [token] for this installation. */
    suspend fun save(token: String)
}

/**
 * One reminder a day, by email and by push to one phone. Every write sends the app's [language] and
 * writes only for the learner who asked for it.
 */
class StudyReminderStore(
    private val api: StudyReminderApi,
    private val cache: AppCache,
    private val push: PushAddress,
    private val sessions: SessionSource,
    private val language: () -> String,
) {
    val reminder: Resource<StudyReminder> =
        cache.resource(Audience.SignedIn, DOMAINS) { session -> session?.let { api.reminder(it) } }

    /** Who a learner's tap writes for, from the tap on, since asking Android and FCM can take a while. */
    val learner: AuthenticatedSession? get() = sessions.current

    private val settings = Mutex()
    private var pushChoices = 0

    fun isThisPhone(reminder: StudyReminder): Boolean = push.token != null && reminder.push.phone?.token == push.token

    suspend fun claimOffer(): MutationResult<Boolean> =
        cache.mutate(invalidating = setOf(DataDomain.StudyReminder)) { session ->
            val locale = StudyReminderOfferClaim.Locale.entries.firstOrNull { it.value == language() } ?: StudyReminderOfferClaim.Locale.EN
            api.claimOffer(session, StudyReminderOfferClaim(locale))
        }

    /** Changes only what it's given. Settings go out one at a time, in the order they were made. */
    suspend fun update(
        time: String? = null,
        emailOn: Boolean? = null,
        pushOn: Boolean? = null,
        learner: AuthenticatedSession? = this.learner,
    ): MutationResult<StudyReminder> {
        if (pushOn != null) pushChoices++
        return settings.withLock { patch(learner, time = time, emailOn = emailOn, pushOn = pushOn) }
    }

    /** Push goes to this phone from now on; whether it's on doesn't change. Ask for notifications first. */
    suspend fun useThisPhone(learner: AuthenticatedSession? = this.learner): MutationResult<StudyReminder> {
        val token = push.register() ?: return MutationResult.Failed(ApiError.Unavailable)
        return save(learner) { session -> api.selectPhone(session, phone(token)) }.also {
            if (it is MutationResult.Done) push.save(token)
        }
    }

    /**
     * "Remind me": this phone, then push on at [time]. Done only once both saved. Push turned off or
     * on again meanwhile wins: this one then leaves it as it is.
     */
    suspend fun turnOnPush(
        time: String? = null,
        learner: AuthenticatedSession? = this.learner,
    ): MutationResult<StudyReminder> {
        val choice = ++pushChoices
        val selected = useThisPhone(learner)
        if (selected !is MutationResult.Done) return selected
        return settings.withLock {
            if (choice != pushChoices) MutationResult.Obsolete else patch(learner, time = time, pushOn = true)
        }
    }

    /**
     * FCM gave this installation [token]: when the token it replaced is the learner's phone, the new one
     * takes its place. The old one stays this installation's until the server has the new one, so a
     * failed upload is tried again (on FCM's next callback or [reconcile]).
     */
    suspend fun follow(token: String) {
        val previous = push.token ?: return
        if (previous == token) return
        val followed =
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
        if (followed is MutationResult.Done) push.save(token)
    }

    /** After the stored session is back: a token that changed while the app was closed, or didn't upload, follows now. */
    suspend fun reconcile() {
        if (push.token == null) return
        push.register()?.let { follow(it) }
    }

    private fun phone(token: String): StudyReminderPhone {
        val locale = StudyReminderPhone.Locale.entries.firstOrNull { it.value == language() } ?: StudyReminderPhone.Locale.EN
        return StudyReminderPhone(push.label.take(MAX_LABEL_LENGTH), locale, PushPlatform.ANDROID, token)
    }

    private suspend fun patch(
        learner: AuthenticatedSession?,
        time: String? = null,
        emailOn: Boolean? = null,
        pushOn: Boolean? = null,
    ): MutationResult<StudyReminder> =
        save(learner) { session ->
            val locale = StudyReminderUpdate.Locale.entries.firstOrNull { it.value == language() } ?: StudyReminderUpdate.Locale.EN
            api.update(session, StudyReminderUpdate(locale, emailOn = emailOn, pushOn = pushOn, time = time))
        }

    /** Another learner since [learner] asked gets nothing written. */
    private suspend fun save(
        learner: AuthenticatedSession?,
        write: suspend (AuthenticatedSession) -> StudyReminder,
    ): MutationResult<StudyReminder> {
        if (learner == null || sessions.current != learner) return MutationResult.Obsolete
        return cache.mutate(invalidating = setOf(DataDomain.StudyReminder), replacing = { listOf(reminder.replacing(it)) }, write = write)
    }

    companion object {
        /** What the read is built from: the reminder, the active goal's zone and study time, and the email. */
        private val DOMAINS = setOf(DataDomain.StudyReminder, DataDomain.Goals, DataDomain.LearningProfile, DataDomain.UserProgress)

        private const val MAX_LABEL_LENGTH = 100
    }
}
