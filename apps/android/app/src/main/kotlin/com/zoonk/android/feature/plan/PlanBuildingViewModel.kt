package com.zoonk.android.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.LiveGenerationSource
import java.util.UUID

class PlanBuildingViewModel(
    store: PlanStore,
    api: ApiClients,
    session: AuthenticatedSession,
    goalId: UUID,
) : ViewModel() {
    val follower =
        GenerationFollower(
            kind = GenerationKind.Curriculum,
            scope = viewModelScope,
            source = LiveGenerationSource(api, session),
            readGenerationId = { store.buildingRunId(session, goalId) },
            restart = { store.rebuild(goalId) },
        )
}
