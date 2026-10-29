package com.zoonk.android.feature.language

import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageProgress

internal const val LANGUAGE_GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"

/** Reading and listening rose a level since the level test; two units done, two ahead. */
internal fun languageProgress(
    level: String? = "A2+",
    target: String? = """{"label":"B2","score":3}""",
    targetDate: String? = "2027-06-30",
    speakingMock: String? = null,
    goalId: String = LANGUAGE_GOAL,
): LanguageProgress =
    ApiJson.decodeFromString(
        """
        {"canDo":[{"done":true,"text":"Order food and drinks","unitTitle":"At the café"},
          {"done":true,"text":"Talk about my weekend","unitTitle":"Free time"},
          {"done":false,"text":"Describe where I live","unitTitle":"Home"},
          {"done":false,"text":"Plan a trip with a friend","unitTitle":"Travel"}],
         "goal":{"id":"$goalId","targetDate":${targetDate?.let { "\"$it\"" }},"targetLanguage":"es","title":"Spanish"},
         "level":${level?.let { "\"$it\"" }},
         "levels":[{"label":"B1+","score":2.5,"skill":"reading","startLabel":"A2+","trend":"up"},
          {"label":"B1","score":2,"skill":"listening","startLabel":"A2","trend":"up"},
          {"label":"A2+","score":1.5,"skill":"speaking","startLabel":"A2+","trend":"same"},
          {"label":"A2","score":1,"skill":"writing","startLabel":"A2+","trend":"down"}],
         "speaking":null,"speakingMock":${speakingMock?.let { "\"$it\"" }},"speakingMockPaused":false,"target":$target}
        """.trimIndent(),
    )
