package com.zoonk.android.feature.activities.code

import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.api.ApiJson
import kotlinx.serialization.json.JsonObject

/** A Java code runner, a language our servers run, whose loop on line 4 stops one short of 100. */
object JavaCodeRunner {
    private val starter =
        listOf(
            "public class Main {",
            "    public static void main(String[] args) {",
            "        int total = 0;",
            "        for (int n = 1; n < 100; n++) total += n;",
            "        System.out.println(total);",
            "    }",
            "}",
        ).joinToString("\n")

    private val json: JsonObject =
        ApiJson
            .parseToJsonElement(
                """
                {
                  "check": { "explanation": "n <= 100 lets the loop add 100 too, so it prints 5050.", "kind": "interaction" },
                  "fields": {
                    "editableLines": [4],
                    "expectedOutput": "5050",
                    "language": "java",
                    "mistakes": [{ "feedback": "The loop stops before it adds 100.", "output": "4950" }],
                    "solution": ${ApiJson.encodeToString(starter.replace("n < 100", "n <= 100"))},
                    "starterCode": ${ApiJson.encodeToString(starter)}
                  },
                  "prompt": "Fix the loop so it adds every whole number from 1 to 100.",
                  "template": "codeRunner"
                }
                """.trimIndent(),
            ) as JsonObject

    val content: ActivityStepContent get() = ApiJson.decodeFromJsonElement(ActivityStepContent.serializer(), json)

    fun step(id: String): LessonStep = ActivityFixtures.step(json, id)
}
