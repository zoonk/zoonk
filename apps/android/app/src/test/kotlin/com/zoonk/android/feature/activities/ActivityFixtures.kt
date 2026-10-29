package com.zoonk.android.feature.activities

import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityExpected
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Main's activity fixtures with core's expected end state and value, from `pnpm --filter android fixtures:activities`. */
object ActivityFixtures {
    private val all: JsonObject by lazy {
        ApiJson.parseToJsonElement(checkNotNull(javaClass.getResource("/activity-fixtures.json")).readText()).jsonObject
    }

    val names: Set<String> get() = all.keys

    private fun entry(name: String) = checkNotNull(all[name]) { "No fixture $name" }.jsonObject

    fun content(name: String): ActivityStepContent =
        ApiJson.decodeFromJsonElement(ActivityStepContent.serializer(), entry(name).getValue("content"))

    fun expected(name: String): ActivityExpected? =
        entry(name)["expected"]?.takeUnless { it is JsonNull }?.let { ApiJson.decodeFromJsonElement(ActivityExpected.serializer(), it) }

    fun value(name: String): Double? = entry(name)["value"]?.jsonPrimitive?.doubleOrNull

    fun step(
        name: String,
        id: String = name,
    ): LessonStep {
        val json = entry(name).getValue("content")
        val content = ApiJson.decodeFromJsonElement(ActivityStepContent.serializer(), json)
        val frame = ApiJson.decodeFromJsonElement(ActivityFrame.serializer(), json)
        return LessonStep(id, null, StepContent.Activity(content, frame, minTolerance = null))
    }
}
