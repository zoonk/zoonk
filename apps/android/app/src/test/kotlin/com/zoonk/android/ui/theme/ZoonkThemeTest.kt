package com.zoonk.android.ui.theme

import android.app.UiModeManager
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf

@RunWith(AndroidJUnit4::class)
class ZoonkThemeTest {
    @get:Rule
    val compose = createComposeRule()

    private val uiModeManager =
        shadowOf(ApplicationProvider.getApplicationContext<android.app.Application>().getSystemService(UiModeManager::class.java))

    @Test
    fun mediumAndHighContrastPickTheMoreContrastScheme() {
        uiModeManager.setContrast(0f)
        var progress = Color.Unspecified
        compose.setContent { ZoonkTheme(darkTheme = false) { progress = MaterialTheme.colorScheme.tertiary } }

        compose.waitForIdle()
        assertEquals(LightPalette.success, progress)

        uiModeManager.setContrast(0.5f)
        compose.waitForIdle()
        assertEquals(LightMoreContrastPalette.success, progress)

        uiModeManager.setContrast(1f)
        compose.waitForIdle()
        assertEquals(LightMoreContrastPalette.success, progress)

        uiModeManager.setContrast(0.25f)
        compose.waitForIdle()
        assertEquals(LightPalette.success, progress)
    }

    @Test
    fun darkThemeHasItsOwnMoreContrastScheme() {
        uiModeManager.setContrast(1f)
        var brain = Color.Unspecified
        compose.setContent { ZoonkTheme(darkTheme = true) { brain = MaterialTheme.zoonk.brain } }

        compose.waitForIdle()
        assertEquals(DarkMoreContrastPalette.brain, brain)
    }
}
