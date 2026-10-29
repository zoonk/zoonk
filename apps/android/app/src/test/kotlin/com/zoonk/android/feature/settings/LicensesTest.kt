package com.zoonk.android.feature.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
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
    fun spdxPlaceholdersReadAsTheirOriginalWording() {
        val template =
            "Copyright (c) <<var;name=copyright;original= <year> <owner>;match=.+>> All rights reserved.\n" +
                "<<beginOptional>>Note<<endOptional>> PROVIDED BY <<var;name=holder;original=THE COPYRIGHT HOLDERS;match=.+>> \"AS IS\""

        assertEquals(
            "Copyright (c) <year> <owner> All rights reserved.\nNote PROVIDED BY THE COPYRIGHT HOLDERS \"AS IS\"",
            readableLicense(template),
        )
    }
}

private const val LOAD_TIMEOUT_MS = 10_000L
