package com.zoonk.android.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

class ShownLocaleTest {
    @Test
    fun aLanguageZoonkLacksShowsEnglishInTheDevicesRegion() {
        assertEquals("en-ES", shown("ca-ES"))
        assertEquals("en-TW", shown("zh-Hant-TW"))
        assertEquals("en-ES-u-fw-mon", shown("ca-ES-u-fw-mon"))
    }

    @Test
    fun theFirstLanguageZoonkHasIsShownAsTheDeviceWritesIt() {
        assertEquals("pt-PT", shown("pt-PT"))
        assertEquals("de-AT", shown("ca-ES", "de-AT", "fr-FR"))
        assertEquals("en-GB", shown("ca-ES", "en-GB", "de-DE"))
        assertEquals("ar-XB", shown("ar-XB", "en-US"))
    }

    private fun shown(vararg tags: String) = shownLocale(tags.map(Locale::forLanguageTag)).toLanguageTag()
}
