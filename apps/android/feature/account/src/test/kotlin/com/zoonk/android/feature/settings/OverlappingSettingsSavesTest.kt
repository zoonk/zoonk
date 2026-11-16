package com.zoonk.android.feature.settings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.reminders.PushAddress
import com.zoonk.android.feature.reminders.StudyReminderApi
import com.zoonk.android.feature.reminders.StudyReminderStore
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderEmail
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderPush
import com.zoonk.api.models.StudyReminderUpdate
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalTime

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class OverlappingSettingsSavesTest {
    @Test
    fun aTimeFailureStillReachesTheScreenAfterEmailIsChanged() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            val first = CompletableDeferred<Unit>()
            val second = CompletableDeferred<Unit>()
            val changes = mutableListOf<StudyReminderUpdate>()
            val saved = StudyReminder(StudyReminderEmail("ana@zoonk.test", false), StudyReminderPush(false, null), false, "19:00", "UTC")
            val api =
                object : StudyReminderApi {
                    override suspend fun reminder(session: AuthenticatedSession) = saved

                    override suspend fun update(
                        session: AuthenticatedSession,
                        update: StudyReminderUpdate,
                    ): StudyReminder {
                        changes += update
                        if (changes.size == 1) {
                            first.await()
                            throw ApiException(ApiError.Network)
                        }
                        second.await()
                        return saved.copy(email = saved.email.copy(on = true))
                    }

                    override suspend fun claimOffer(
                        session: AuthenticatedSession,
                        claim: StudyReminderOfferClaim,
                    ) = false

                    override suspend fun selectPhone(
                        session: AuthenticatedSession,
                        phone: StudyReminderPhone,
                    ) = saved
                }
            val push =
                object : PushAddress {
                    override val token: String? = null
                    override val label = "test"

                    override suspend fun register(): String? = null

                    override suspend fun save(token: String) = Unit
                }
            try {
                val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
                val model = RemindersViewModel(StudyReminderStore(api, AppCache(session, backgroundScope), push, session) { "en" })
                models.put("reminders", model)
                model.setTime(LocalTime.of(20, 0))
                runCurrent()
                assertEquals("20:00", changes.single().time)
                model.setEmail(true)
                runCurrent()
                assertEquals(1, changes.size)
                assertNull(model.saveFailed.value)

                first.complete(Unit)
                runCurrent()
                assertNotNull(model.saveFailed.value)
                assertEquals(true, changes.last().emailOn)
                second.complete(Unit)
                runCurrent()
                assertNotNull(model.saveFailed.value)
                model.saveFailed.acted(Unit)
                assertNull(model.saveFailed.value)
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }

    @Test
    fun aSoundsFailureSurvivesLaterCountryAndBuddyChanges() = checkPreferences(Setting.Sounds)

    @Test
    fun aCountryFailureSurvivesLaterSoundsAndBuddyChanges() = checkPreferences(Setting.Country)

    @Test
    fun aBuddyFailureSurvivesLaterSoundsAndCountryChanges() = checkPreferences(Setting.Buddy)

    private fun checkPreferences(earlier: Setting) {
        for (later in Setting.entries.filter { it != earlier }) {
            runTest {
                Dispatchers.setMain(StandardTestDispatcher(testScheduler))
                val models = ViewModelStore()
                val first = CompletableDeferred<Unit>()
                val second = CompletableDeferred<Unit>()
                val changes = mutableListOf<JsonObject>()
                val saved = ApiJson.decodeFromString<LearningProfile>(PROFILE)
                val api =
                    object : LearningProfileApi {
                        override suspend fun profile(session: AuthenticatedSession) = saved

                        override suspend fun update(
                            session: AuthenticatedSession,
                            change: JsonObject,
                        ): LearningProfile {
                            changes += change
                            if (changes.size == 1) {
                                first.await()
                                throw ApiException(ApiError.Network)
                            }
                            second.await()
                            return saved
                        }
                    }
                try {
                    val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
                    val model = PreferencesViewModel(LearningProfileStore(api, AppCache(session, backgroundScope)), SavedStateHandle())
                    models.put("preferences", model)
                    model.editBuddy(true)
                    change(model, earlier)
                    runCurrent()
                    assertTrue(changes.single().containsKey(earlier.field))
                    change(model, later)
                    runCurrent()
                    assertEquals(1, changes.size)
                    assertNull(model.saveFailed.value)
                    assertFalse(model.buddySaveFailed)

                    first.complete(Unit)
                    runCurrent()
                    assertFailure(model, earlier)
                    assertTrue(changes.last().containsKey(later.field))
                    second.complete(Unit)
                    runCurrent()
                    assertFailure(model, earlier)
                    if (earlier != Setting.Buddy) {
                        model.saveFailed.acted(Unit)
                        assertNull(model.saveFailed.value)
                    }
                } finally {
                    models.clear()
                    Dispatchers.resetMain()
                }
            }
        }
    }

    private fun change(
        model: PreferencesViewModel,
        setting: Setting,
    ) {
        when (setting) {
            Setting.Sounds -> model.setSoundsEnabled(false)
            Setting.Country -> model.setHomeCountry(CountryChoice("BR", "Brazil"))
            Setting.Buddy -> model.setBuddy(BuddyKind.Zu, BuddyGlasses.Round, "Nox")
        }
    }

    private fun assertFailure(
        model: PreferencesViewModel,
        earlier: Setting,
    ) {
        if (earlier == Setting.Buddy) assertTrue(model.buddySaveFailed) else assertNotNull(model.saveFailed.value)
    }

    private enum class Setting(
        val field: String,
    ) {
        Sounds("soundsEnabled"),
        Country("homeCountry"),
        Buddy("buddy"),
    }

    private companion object {
        const val PROFILE =
            """{"activeGoalId":null,"availableGlasses":["round"],"homeCountry":null,"homeCountryName":null,"suggested":[],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":true},"shareUsageData":null,"soundsEnabled":true}"""
    }
}
