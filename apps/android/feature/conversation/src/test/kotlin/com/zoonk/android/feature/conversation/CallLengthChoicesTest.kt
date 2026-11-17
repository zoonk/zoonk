package com.zoonk.android.feature.conversation
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallLengthChoicesTest {
    @Test fun aSpentCallAllowanceDisablesLengthChangesUntilItReturns() {
        assertFalse(callLengthsEnabled(blocked = true))
        assertTrue(callLengthsEnabled(blocked = false))
    }
}
