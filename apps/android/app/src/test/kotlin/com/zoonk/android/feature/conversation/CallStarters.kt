package com.zoonk.android.feature.conversation

import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.data.writingWaits

internal fun callStarter(
    runs: GenerationSource = WritingRuns(),
    answer: suspend (CallRequest) -> CallStart,
): CallStarter =
    object : CallStarter {
        override val writingWaits = writingWaits(runs)

        override suspend fun start(request: CallRequest) = answer(request)
    }
