package com.zoonk.android.feature.settings

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.reminders.PushAddress
import com.zoonk.android.feature.reminders.StudyReminderApi
import com.zoonk.android.feature.reminders.StudyReminderStore
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderUpdate
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * A reminder switch that didn't save says so once on the visit that flipped it: through the window widening and
 * narrowing while it saves, and not at all when the learner left the page first.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class RemindersWindowTest {
    @get:Rule
    val rule = createEmptyComposeRule()

    @Test
    fun aSwitchThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = check(leave = true)

    @Test
    fun aSwitchThatFailsWhileTheWindowWidensAndNarrowsSaysSoOnce() = check(leave = false)

    private fun check(leave: Boolean) {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = RemindersTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val api =
            object : StudyReminderApi {
                override suspend fun reminder(session: AuthenticatedSession): StudyReminder = throw ApiException(ApiError.Network)

                override suspend fun update(
                    session: AuthenticatedSession,
                    update: StudyReminderUpdate,
                ): StudyReminder {
                    held.await()
                    throw ApiException(ApiError.Network)
                }

                override suspend fun claimOffer(
                    session: AuthenticatedSession,
                    claim: StudyReminderOfferClaim,
                ) = false

                override suspend fun selectPhone(
                    session: AuthenticatedSession,
                    phone: StudyReminderPhone,
                ): StudyReminder = throw ApiException(ApiError.Network)
            }
        val push =
            object : PushAddress {
                override val token: String? = null
                override val label = "test"

                override suspend fun register(): String? = null

                override suspend fun save(token: String) = Unit
            }
        RemindersTest.model = RemindersViewModel(StudyReminderStore(api, AppCache(session, scope), push, session) { "en" })
        RemindersTest.shown.value = true
        RemindersTest.said = 0
        val scenario = ActivityScenario.launch(RemindersTestActivity::class.java)
        try {
            rule.runOnIdle { RemindersTest.model.setEmail(true) }
            if (leave) {
                rule.runOnIdle { RemindersTest.shown.value = false }
            } else {
                RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
                scenario.recreate()
                RuntimeEnvironment.setQualifiers("w411dp-h891dp")
                scenario.recreate()
            }
            rule.waitForIdle()
            held.complete(Unit)
            rule.waitForIdle()
            rule.runOnIdle { RemindersTest.shown.value = true }
            rule.waitForIdle()
            assertEquals(if (leave) 0 else 1, RemindersTest.said)

            scenario.recreate()
            rule.waitForIdle()
            assertEquals("a later recreation says it again", if (leave) 0 else 1, RemindersTest.said)
        } finally {
            scenario.close()
            scope.cancel()
        }
    }
}

/** What outlives [RemindersTestActivity]'s recreations, as the page's view model does. */
object RemindersTest {
    lateinit var model: RemindersViewModel
    val shown = mutableStateOf(true)
    var said = 0
}

class RemindersTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            if (RemindersTest.shown.value) {
                VisitOf(RemindersTest.model.visit)
                ActOn(RemindersTest.model.saveFailed) { RemindersTest.said++ }
            }
        }
    }
}
