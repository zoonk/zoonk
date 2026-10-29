package com.zoonk.android.feature.mock.result

import com.zoonk.android.feature.mock.runner.ITEM_THREE
import com.zoonk.android.feature.mock.runner.runningMock
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MockExam
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

internal const val ESSAY_ONE = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b31"
internal const val ESSAY_TWO = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b32"
internal const val GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"

/** Two areas, one right of three: Mathematics went 1 of 2, Languages 0 of 1. */
internal fun result(
    scoring: String = "raw",
    extra: String = "",
): String {
    val fields =
        """"areas":[{"correct":1,"name":"Mathematics","score":null,"secondsPerQuestion":95,"targetSecondsPerQuestion":60,"total":2},
        {"correct":0,"name":"Languages","score":null,"secondsPerQuestion":30,"targetSecondsPerQuestion":null,"total":1}],
        "blank":0,"calibration":null,"coherence":null,"correct":1,"irt":null,"minutesUsed":20,"net":null,"plannedMinutes":60,
        "preparation":null,"previous":null,"scoring":"$scoring",
        "topics":[{"area":"Mathematics","correct":1,"name":"Addition","skillId":"s1","total":2},
        {"area":"Languages","correct":0,"name":"Nouns","skillId":"s2","total":1}],"total":3,"unansweredAtTimeout":0"""
    val more = if (extra.isEmpty()) emptyMap() else ApiJson.parseToJsonElement("{$extra}").jsonObject
    return JsonObject(ApiJson.parseToJsonElement("{$fields}").jsonObject + more).toString()
}

internal const val NET =
    """"net":{"blank":10,"max":120,"net":41.5,"partial":0,"penalty":1,"right":58,"wrong":52},"previous":35"""

internal const val IRT = """"irt":{"high":680,"low":610,"score":645,"se":18,"theta":0.4},"previous":612"""

internal const val MISSED =
    """{"area":"Languages","citation":null,"context":null,"correctAnswer":"house","explanation":"A noun names a thing.",
    "format":"multipleChoice","itemId":"$ITEM_THREE","learnerAnswer":"run","number":3,"outcome":"wrong",
    "question":"Which word is a noun?","set":null}"""

internal const val SKIP_OFFER = """{"focus":null,"skip":{"lessons":3,"topics":["Addition","Fractions"]}}"""

internal fun pendingEssay(item: String = ESSAY_ONE) =
    """{"area":"Writing","context":null,"grade":null,"itemId":"$item","question":"Write about cities.","status":"pending","text":"Cities grow."}"""

internal fun gradedEssay(item: String = ESSAY_ONE) =
    """{"area":"Writing","context":null,"itemId":"$item","question":"Write about cities.","status":"graded","text":"Cities grow.",
    "grade":{"criteria":[
      {"maxScore":200,"score":160,"comment":"Clear.","example":null,"id":"c1","name":"C1","quote":null},
      {"maxScore":200,"score":160,"comment":"On topic.","example":null,"id":"c2","name":"C2","quote":null},
      {"maxScore":200,"score":120,"comment":"Loose.","example":"Because cities grow, transport must too.","id":"c3","name":"C3",
       "quote":"Cities grow and that is it."},
      {"maxScore":200,"score":160,"comment":"Linked.","example":null,"id":"c4","name":"C4","quote":null},
      {"maxScore":200,"score":80,"comment":"Missing.","example":null,"id":"c5","name":"C5","quote":null}],
     "enemInterventionElements":null,"nextStep":{"criterionId":"c3","text":"Tie each argument to your thesis."},
     "range":{"high":720,"low":640},"total":{"maxScore":1000,"score":680},"zeroReason":null}}"""

internal const val SPEAKING =
    """{"exam":"dele","language":"es","level":"B2","paper":"Prueba 4","source":"https://examenes.cervantes.es/dele-b2","title":"DELE B2",
    "estimate":{"complete":true,"high":17,"low":14,"total":25,"typed":false},"id":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b41",
    "pass":{"kind":"group","min":30,"of":50},"prepMinutes":20,"prepTasks":["1","2"],
    "tasks":[{"key":"1","minutes":{"min":6,"max":7},"mode":"monologueThenInteraction","name":"Valorar propuestas","options":2,"prepMinutes":10,
      "prepShared":null,"role":"examiner","stimulus":"text","conversationId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b51","status":"completed"},
     {"key":"2","minutes":{"min":5,"max":5},"mode":"monologue","name":"Describir una situación","options":1,"prepMinutes":0,
      "prepShared":null,"role":"partner","stimulus":"photos","conversationId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b52","status":"completed"}]}"""

/** A finished mock; [extra]'s top-level fields replace the defaults. */
internal fun finishedMock(
    result: String = result(),
    extra: String = "",
): MockExam =
    runningMock(
        current = "null",
        extra = """"status":"finished","result":$result,"sections":[]${if (extra.isEmpty()) "" else ",$extra"}""",
    )
