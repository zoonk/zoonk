package com.zoonk.android.feature.tutor

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TutorPromptTest {
    @Test fun missingIdentityAsksForHelpInsteadOfNamingAFallback() {
        assertTrue(TutorPrompt(null).asksForHelp)
    }

    @Test fun aKnownBuddyIsNamed() {
        assertFalse(TutorPrompt("Sam").asksForHelp)
    }
}
