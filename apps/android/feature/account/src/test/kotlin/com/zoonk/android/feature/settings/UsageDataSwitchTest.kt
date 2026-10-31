package com.zoonk.android.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
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

@RunWith(AndroidJUnit4::class)
class UsageDataSwitchTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val noChoice: LearningProfile =
        ApiJson.decodeFromString(
            """
            {"activeGoalId":null,"availableGlasses":["round"],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},
             "dailyLimitMinutes":null,"dailyTimes":[5,15],"shareUsageData":null,"soundsEnabled":true}
            """.trimIndent(),
        )

    private fun show(
        profile: LearningProfile,
        usageDataSharing: Boolean?,
    ) {
        val api =
            object : LearningProfileApi {
                override suspend fun profile(session: AuthenticatedSession) = profile

                override suspend fun update(
                    session: AuthenticatedSession,
                    change: JsonObject,
                ) = profile
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        compose.setContent {
            ZoonkTheme {
                UsageDataSection(
                    profile,
                    usageDataSharing,
                    PreferencesViewModel(LearningProfileStore(api, cache)),
                )
            }
        }
    }

    @Test
    fun withNoChoiceWhereTheLawAsksFirstItShowsOff() {
        show(noChoice, usageDataSharing = null)

        compose.onNode(isToggleable()).assertIsOff()
    }

    @Test
    fun withNoChoiceElsewhereItShowsOn() {
        show(noChoice, usageDataSharing = true)

        compose.onNode(isToggleable()).assertIsOn()
    }

    @Test
    fun aSavedChoiceShowsAsItIs() {
        show(noChoice.copy(shareUsageData = false), usageDataSharing = true)

        compose.onNode(isToggleable()).assertIsOff()
    }
}
