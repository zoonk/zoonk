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

    private fun startsAnother(
        vararg before: SessionState,
        next: SessionState.SignedIn,
    ): Boolean = before.fold(ShownLearner()) { shown, state -> shown.after(state) }.startsAnother(next)

    @Test
    fun onlyADifferentLearnerStartsFromTheRoots() {
        assertEquals(
            listOf(false, false, true, true, false, true),
            listOf(
                startsAnother(next = signedIn(ANA)),
                startsAnother(signedIn(ANA), next = signedIn(ANA)),
                startsAnother(signedIn(ANA), next = signedIn(BIA)),
                startsAnother(signedIn(ANA), SessionState.SignedOut(), next = signedIn(BIA)),
                startsAnother(signedIn(GUEST, isGuest = true), next = signedIn(ANA)),
                startsAnother(signedIn(GUEST, isGuest = true), next = signedIn(BIA, isGuest = true)),
            ),
        )
    }

    @Test
    fun aGuestWhoseSessionEndedBringsNothingIntoTheNextAccount() {
        assertEquals(
            true,
            startsAnother(signedIn(GUEST, isGuest = true), SessionState.SignedOut(sessionEnded = true), next = signedIn(ANA)),
        )
    }
}
