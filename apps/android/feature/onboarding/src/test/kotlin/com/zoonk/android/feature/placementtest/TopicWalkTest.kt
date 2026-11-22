package com.zoonk.android.feature.placementtest

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import org.junit.Assert.assertEquals
import org.junit.Test

class TopicWalkTest {
    @Test
    fun aPlanReadFromBeforeTheWalkOpenedWaitsForAReadSince() {
        assertEquals(null, topicWalkOf(walking = false, fresh = LoadState.Idle, walked = false))
        assertEquals(null, topicWalkOf(walking = false, fresh = LoadState.Loading, walked = false))
        assertEquals(false, topicWalkOf(walking = false, fresh = LoadState.Loaded(Unit), walked = false))
        assertEquals(false, topicWalkOf(walking = false, fresh = LoadState.Failed(ApiError.Network), walked = false))
    }

    @Test
    fun aWalkShownStaysWhateverTheReadSays() {
        assertEquals(true, topicWalkOf(walking = true, fresh = LoadState.Idle, walked = false))
        assertEquals(true, topicWalkOf(walking = false, fresh = LoadState.Loaded(Unit), walked = true))
        assertEquals(null, topicWalkOf(walking = null, fresh = LoadState.Loading, walked = false))
    }
}
