package com.zoonk.android.feature.player

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.reminders.PushAddress
import com.zoonk.android.feature.reminders.StudyReminderApi
import com.zoonk.android.feature.reminders.StudyReminderStore
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderUpdate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ReminderOfferViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession("ana", "token", "local"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun offer(claim: suspend () -> Boolean): ReminderOfferViewModel {
        val api =
            object : StudyReminderApi {
                override suspend fun claimOffer(
                    session: AuthenticatedSession,
                    claim: StudyReminderOfferClaim,
                ) = claim()

                override suspend fun reminder(session: AuthenticatedSession): StudyReminder = error("Not used")

                override suspend fun update(
                    session: AuthenticatedSession,
                    update: StudyReminderUpdate,
                ): StudyReminder = error("Not used")

                override suspend fun selectPhone(
                    session: AuthenticatedSession,
                    phone: StudyReminderPhone,
                ): StudyReminder = error("Not used")

                override suspend fun removePhone(
                    session: AuthenticatedSession,
                    token: String,
                ): StudyReminder = error("Not used")
            }
        val push =
            object : PushAddress {
                override val token: String? = null
                override val label = "Pixel 9"

                override suspend fun register(): String? = null
            }
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        return ReminderOfferViewModel(StudyReminderStore(api, cache, push) { "en" }, "19:00")
    }

    @Test
    fun theChoicesShowOnlyOnceThisShowingClaimedTheOffer() =
        runTest(dispatcher) {
            val claimed = offer { true }
            val elsewhere = offer { false }
            val failed = offer { throw ApiException(ApiError.Network) }

            listOf(claimed, elsewhere, failed).forEach { it.seen() }
            assertEquals(OfferStep.Claiming, claimed.step)
            advanceUntilIdle()

            assertEquals(OfferStep.Asking, claimed.step)
            assertEquals(OfferStep.Gone, elsewhere.step)
            assertEquals(OfferStep.Gone, failed.step)
        }
}
