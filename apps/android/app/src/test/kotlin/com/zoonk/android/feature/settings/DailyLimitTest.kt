package com.zoonk.android.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class DailyLimitTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val profile: LearningProfile =
        ApiJson.decodeFromString(
            """
            {"activeGoalId":null,"availableGlasses":["round"],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},
             "dailyLimitMinutes":200,"dailyTimes":[5,15,1440],"shareUsageData":null,"soundsEnabled":true}
            """.trimIndent(),
        )

    private fun aDay(minutes: Int) = "${formatMinutes(minutes, Locale.ENGLISH)} a day"

    private fun show(profile: LearningProfile) {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val api =
            object : LearningProfileApi {
                override suspend fun profile(session: AuthenticatedSession) = profile

                override suspend fun update(
                    session: AuthenticatedSession,
                    change: JsonObject,
                ) = profile
            }
        val store = LearningProfileStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
        compose.setContent { ZoonkTheme { LessonsSection(profile, PreferencesViewModel(store)) } }
        compose.onNodeWithText("Daily time limit").performClick()
    }

    @Test
    fun aSavedLimitThePlansTimesLackShowsAsItselfAmongThem() {
        show(profile)

        compose.onNode(hasText(aDay(200)) and isSelected()).assertExists()
        compose.onNodeWithText(aDay(5)).assertExists()
        compose.onNodeWithText(aDay(1440)).assertExists()
    }

    @Test
    fun theMenuOpensOnTheSavedLimitWhereverItIsInTheList() {
        show(profile.copy(dailyLimitMinutes = 1440, dailyTimes = PLAN_TIMES))

        compose.onNode(hasText(aDay(1440)) and isSelected()).assertIsDisplayed()
    }
}

/** Core's `DAILY_TIME_CHOICES`: 5 and 10 minutes, quarter hours to 4 hours, then half hours to 24 hours. */
private val PLAN_TIMES = listOf(5L, 10L) + (15L..240L step 15).toList() + (270L..1440L step 30).toList()
