package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class TabRootScaffoldTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aTabFailureRetriesFromTheBottomBar() {
        var retried = false
        compose.setContent {
            ZoonkTheme {
                TabRootScaffold { padding ->
                    Column(Modifier.padding(padding)) { LoadFailedMessage(onRetry = { retried = true }) }
                }
            }
        }
        val retry = compose.onNodeWithText("Try again")
        assertTrue(retry.getUnclippedBoundsInRoot().top > compose.onRoot().getUnclippedBoundsInRoot().bottom / 2)
        retry.performClick()
        assertTrue(retried)
    }
}
