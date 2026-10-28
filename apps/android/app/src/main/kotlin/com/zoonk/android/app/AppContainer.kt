package com.zoonk.android.app

import com.zoonk.android.navigation.LearnerAccess
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** The app's long-lived objects, made once per process and passed to screens by constructor. */
class AppContainer {
    /**
     * Who the shell shows screens to, which its gates read. The session and the learner summary
     * decide it once they exist; until then every screen opens as for a learner with a goal.
     */
    val learnerAccess: StateFlow<LearnerAccess> = MutableStateFlow(LearnerAccess.Learner)
}
