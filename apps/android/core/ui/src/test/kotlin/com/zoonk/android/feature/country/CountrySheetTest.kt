package com.zoonk.android.feature.country

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException

@RunWith(AndroidJUnit4::class)
class CountrySheetTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aSearchKeepsTheFailedListsRetryUntilTheListLoads() {
        var offline = true
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val countries =
            CountryStore(
                { if (offline) throw IOException("offline") else listOf(CountryChoice("BR", "Brazil"), CountryChoice("PT", "Portugal")) },
                cache,
            )
        compose.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalCountryCatalog provides countries.catalog) {
                    CountrySheet("Country", listOf(CountryChoice("BR", "Brazil")), "en", null, {}, {})
                }
            }
        }

        compose.onNode(hasSetTextAction()).performTextInput("Portugal")
        compose.onNodeWithText("No country found").assertDoesNotExist()
        compose.onNodeWithText("Couldn't load the list.").assertExists()

        offline = false
        compose.onNodeWithText("Try again").performClick()
        compose.waitForIdle()
        compose.onNode(hasText("Portugal") and !hasSetTextAction()).assertExists()
        compose.onNodeWithText("Couldn't load the list.").assertDoesNotExist()
    }
}
