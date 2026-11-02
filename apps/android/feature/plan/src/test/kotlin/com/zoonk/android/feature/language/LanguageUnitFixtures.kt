package com.zoonk.android.feature.language

import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageUnit
import java.util.UUID

private val CHAPTER = UUID.fromString("00000000-0000-4000-8000-0000000000e1")
private val GOAL = UUID.fromString("00000000-0000-4000-8000-0000000000e2")
private val NEXT_LESSON = UUID.fromString("00000000-0000-4000-8000-0000000000e4")
private val PATTERN = UUID.fromString("00000000-0000-4000-8000-0000000000e6")

internal fun languageUnit(): LanguageUnit {
    fun lesson(
        id: String,
        title: String,
        done: Boolean,
        state: String,
    ) = """{"done":$done,"lessonId":"$id","minutes":10,"state":"$state","title":"$title","written":true}"""

    val lessons =
        listOf(
            lesson("00000000-0000-4000-8000-0000000000e3", "Greet the waiter", true, "done"),
            lesson("$NEXT_LESSON", "Order a coffee", false, "next"),
            lesson("00000000-0000-4000-8000-0000000000e5", "Pay the bill", false, "upcoming"),
        ).joinToString(",")

    return ApiJson.decodeFromString(
        """
        {"canTestOut":true,
         "conversation":{"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":null,"minutes":[1,2,3],"paused":false,"plusMinutes":[5]},
         "goalId":"$GOAL",
         "grammarTips":[{"title":"Querer and quisiera","text":"Use quisiera to ask politely."}],
         "lessons":[$lessons],
         "mistakes":[{"answer":"café solo","correctAnswer":"café con leche","explanation":null,"id":"00000000-0000-4000-8000-0000000000e8",
           "question":"What did she order?","skill":"listening"}],
         "pattern":{"id":"$PATTERN","kind":"pattern","title":"Ser and estar"},
         "pronunciation":{"count":2,"words":["leche","cuenta"]},
         "summaries":[{"ideas":["Quisiera asks politely."],"lessonId":"00000000-0000-4000-8000-0000000000e3","title":"Greet the waiter"}],
         "unit":{"chapterId":"$CHAPTER","description":"At a café","levelRange":"A1–A2","objectives":["Order food and drinks"],"position":3,"title":"At the café"},
         "words":{"count":12,"sample":["hola","gracias"]}}
        """.trimIndent(),
    )
}
