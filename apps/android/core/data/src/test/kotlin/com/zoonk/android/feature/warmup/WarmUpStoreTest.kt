package com.zoonk.android.feature.warmup

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import kotlinx.coroutines.test.TestScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WarmUpStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val session = FakeSession(ana)
    private val store = WarmUpStore({ _, _ -> error("No deck is read here") }, AppCache(session, TestScope()), session)

    @Test
    fun aDeckIsClaimedOnceAcrossWaitsInTheSameVisit() {
        assertTrue(store.claimShown("deck-1"))
        assertFalse(store.claimShown("deck-1"))
        assertTrue(store.claimShown("deck-2"))

        session.session = null
        assertFalse(store.claimShown("deck-1"))

        session.session = ana.copy(localId = "another-visit")
        assertTrue(store.claimShown("deck-1"))
    }

    @Test
    fun aDeckGoesOnAfterTheFurthestCardAnswered() {
        store.answered("deck-1", 0)
        store.answered("deck-1", 1)
        store.answered("deck-1", 0)

        assertEquals(2, store.next("deck-1"))
        assertEquals(0, store.next("deck-2"))
    }

    @Test
    fun anotherLearnerStartsTheDeckOver() {
        store.answered("deck-1", 0)

        session.session = AuthenticatedSession("bo", "token-b", "local-b")
        assertEquals(0, store.next("deck-1"))

        session.session = ana
        assertEquals(1, store.next("deck-1"))
    }
}
