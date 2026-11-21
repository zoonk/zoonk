package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.WrittenPartPoints
import org.junit.Assert.assertEquals
import org.junit.Test

class WrittenMinimumTest {
    private fun part(minimum: String) =
        ApiJson.decodeFromString(
            WrittenPartPoints.serializer(),
            """{"name":"Written test","max":40,"minimum":$minimum,"range":{"low":10,"high":15},"scale":"points",
            "standing":"below","tasks":[],"decimals":0}""",
        )

    @Test
    fun aPercentMinimumIsThatShareOfThePartsPoints() = assertEquals(20.0, part("""{"unit":"percent","value":50}""").minimumPoints()!!, 0.0)

    @Test
    fun aPointsMinimumIsKept() = assertEquals(25.0, part("""{"unit":"points","value":25}""").minimumPoints()!!, 0.0)
}
