package com.zoonk.android.feature.catalog

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class LanguageFlagLabelTest {
    @Test
    fun aFlagReadsAsItsLanguageInThatCountry() {
        assertEquals("Chinese (China)", languageFlagLabel("zh", "cn", Locale.ENGLISH))
        assertEquals("Chinese (Taiwan)", languageFlagLabel("zh-TW", "tw", Locale.ENGLISH))
        assertEquals("Cantonese (Hong Kong)", languageFlagLabel("yue", "hk", Locale.ENGLISH))
        assertEquals("Brazilian Portuguese", languageFlagLabel("pt", "br", Locale.ENGLISH))
        assertEquals("Chinês (Taiwan)", languageFlagLabel("zh-TW", "tw", Locale.forLanguageTag("pt")))
    }
}
