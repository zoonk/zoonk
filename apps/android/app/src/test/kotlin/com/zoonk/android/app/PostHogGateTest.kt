package com.zoonk.android.app

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PostHogGateTest {
    private fun batch(vararg distinctIds: String) =
        Request
            .Builder()
            .url("https://posthog.test/batch")
            .post(
                """{"api_key":"phc","batch":[${distinctIds.joinToString { """{"event":"Today Viewed","distinct_id":"$it"}""" }}]}"""
                    .toRequestBody("application/json".toMediaType()),
            ).build()

    private val flags =
        Request
            .Builder()
            .url("https://posthog.test/flags/?v=2")
            .post("{}".toRequestBody())
            .build()

    @Test
    fun nothingLeavesWhileNoLearnerShares() {
        assertFalse(batch("ana").mayLeaveAs(emptySet()))
        assertFalse(flags.mayLeaveAs(emptySet()))
    }

    @Test
    fun aBatchLeavesOnlyWithTheSharingLearnersEvents() {
        val ana = setOf("ana", "ana-before-identify")

        assertTrue(batch("ana-before-identify", "ana").mayLeaveAs(ana))
        assertFalse(batch("bia", "ana").mayLeaveAs(ana))
    }

    @Test
    fun onlyBatchesEverLeave() {
        assertFalse(flags.mayLeaveAs(setOf("ana")))
    }
}
