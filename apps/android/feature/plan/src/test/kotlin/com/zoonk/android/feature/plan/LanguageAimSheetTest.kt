package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.languageAimOf
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageAim
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h1600dp")
class LanguageAimSheetTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun eachAimSaysWhenItIsReachedAsMainDoes() {
        val aim = ApiJson.decodeFromString(LanguageAim.serializer(), languageAimOf("B1", targetLanguage = "fr"))
        compose.setContent {
            ZoonkTheme {
                LanguageAimSheet(
                    "B1",
                    aim.choices,
                    onDismiss = {},
                    onPick = {},
                    endDate = PlanForecast.On(LocalDate.of(2027, 3, 1), year = false),
                    endDates =
                        mapOf(
                            "A2" to null,
                            "B2" to PlanForecast.On(LocalDate.of(2031, 1, 1), year = true),
                            "C1" to PlanForecast.Beyond,
                        ),
                )
            }
        }

        compose.waitUntilAtLeastOneExists(hasText("In 10+ years"))
        compose.onNodeWithText("Around March\u00A02027").assertExists()
        compose.onNodeWithText("Around 2031").assertExists()
    }
}
