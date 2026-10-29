package com.zoonk.android.feature.settings

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mikepenz.aboutlibraries.Libs
import com.zoonk.android.R
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class LicensesTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun listsTheBuildsLibrariesAndAbcjsWithItsCopyright() {
        rule.setContent { ZoonkTheme { LicensesScreen(rememberAppNavigator()) } }

        rule.waitUntil(LOAD_TIMEOUT_MS) { rule.onAllNodes(hasScrollAction()).fetchSemanticsNodes().isNotEmpty() }
        val list = rule.onNode(hasScrollAction())
        list.performScrollToNode(hasText("okhttp"))
        rule.onNode(hasText("okhttp")).assertIsDisplayed()
        list.performScrollToNode(hasText("abcjs"))
        rule.onNode(hasText("abcjs") and hasClickAction()).performClick()

        rule.onNode(hasText("Copyright (c) 2009-2026 Paul Rosen and Gregory Dyke", substring = true)).assertIsDisplayed()
    }

    @Test
    fun everyLicenseTheBuildShipsHasItsTextOrALink() {
        val json =
            ApplicationProvider
                .getApplicationContext<Context>()
                .resources
                .openRawResource(R.raw.aboutlibraries)
                .bufferedReader()
                .use { it.readText() }
        val missing =
            Libs
                .Builder()
                .withJson(json)
                .build()
                .licenses
                .filter { it.licenseContent.isNullOrBlank() && it.url.isNullOrBlank() }

        assertEquals(emptyList<String>(), missing.map { it.name })
    }
}

private const val LOAD_TIMEOUT_MS = 10_000L
