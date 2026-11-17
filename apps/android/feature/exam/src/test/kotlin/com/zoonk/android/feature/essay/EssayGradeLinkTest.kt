package com.zoonk.android.feature.essay
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EssayGradeLinkTest {
    @Test fun aGradeLinkNeedsARealGradeThatIsNotAlreadyVisible() {
        assertFalse(essayGradeLinkVisible(hasGrade = true, tooShort = true, beside = false))
        assertFalse(essayGradeLinkVisible(hasGrade = true, tooShort = false, beside = true))
        assertFalse(essayGradeLinkVisible(hasGrade = false, tooShort = false, beside = false))
        assertTrue(essayGradeLinkVisible(hasGrade = true, tooShort = false, beside = false))
    }
}
