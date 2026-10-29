package com.zoonk.android.app

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.BIA
import com.zoonk.android.data.GUEST
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.account
import org.junit.Assert.assertEquals
import org.junit.Test

class AnotherLearnerTest {
    private fun signedIn(
        accountId: String,
        isGuest: Boolean = false,
    ) = SessionState.SignedIn(AuthenticatedSession(accountId, "token", "local"), account(accountId), isGuest)

    @Test
    fun onlyADifferentLearnerStartsFromTheRoots() {
        assertEquals(
            listOf(false, false, true, false, true),
            listOf(
                startsAnotherLearner(null, false, signedIn(ANA)),
                startsAnotherLearner(ANA, false, signedIn(ANA)),
                startsAnotherLearner(ANA, false, signedIn(BIA)),
                startsAnotherLearner(GUEST, true, signedIn(ANA)),
                startsAnotherLearner(GUEST, true, signedIn(BIA, isGuest = true)),
            ),
        )
    }
}
