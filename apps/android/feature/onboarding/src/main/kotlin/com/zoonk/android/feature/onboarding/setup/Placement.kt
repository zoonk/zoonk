package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Question
import com.zoonk.api.models.PlacementQuestion

internal val LoadState<*>.isPending get() = this == LoadState.Idle || this == LoadState.Loading

internal fun PlacementQuestion.item(): Question = recode()
