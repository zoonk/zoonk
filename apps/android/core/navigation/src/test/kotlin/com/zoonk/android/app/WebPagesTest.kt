package com.zoonk.android.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebPagesTest {
    @Test
    fun opensWebPagesAndEmail() {
        listOf("https://zoonk.com/support", "http://example.com", "HTTPS://example.com", "mailto:hello@zoonk.com")
            .forEach { assertTrue(it, mayOpenLink(it)) }
    }

    /** Lesson text and sources are AI-written, so a link in them can name any scheme. */
    @Test
    fun neverCallsMessagesOrOpensAnotherApp() {
        listOf(
            "tel:+15555550100",
            "sms:+15555550100",
            "intent://scan#Intent;scheme=zxing;end",
            "zoonk://session",
            "market://details?id=com.example",
            "javascript:alert(1)",
            "/mistakes",
        ).forEach { assertFalse(it, mayOpenLink(it)) }
    }
}
