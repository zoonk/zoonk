package com.zoonk.android.feature.activities.music

import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.api.ApiJson

/** An activity step from content written out in a test, for cases main's fixtures don't have. */
fun activityStep(
    content: String,
    id: String = "act",
): LessonStep {
    val json = ApiJson.parseToJsonElement(content)
    return LessonStep(
        id,
        null,
        StepContent.Activity(
            ApiJson.decodeFromJsonElement(ActivityStepContent.serializer(), json),
            ApiJson.decodeFromJsonElement(ActivityFrame.serializer(), json),
            minTolerance = null,
        ),
    )
}
