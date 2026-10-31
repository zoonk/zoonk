package com.zoonk.android.feature.onboarding.setup

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NonLatinScriptTest {
    @Test
    fun languagesUsuallyWrittenInAnotherScriptUseIt() {
        for (tag in listOf("yue", "kk", "ky", "tg", "ug", "zh", "zh-TW", "ja")) {
            assertTrue(tag, usesNonLatinScript(tag))
        }
    }

    @Test
    fun aTagThatNamesTheLatinScriptUsesIt() {
        assertFalse(usesNonLatinScript("sr-Latn"))
    }

    @Test
    fun latinAndUnknownLanguagesUseTheLatinScript() {
        for (tag in listOf("it", "pt", "es-419", "zzz")) {
            assertFalse(tag, usesNonLatinScript(tag))
        }
    }
}
