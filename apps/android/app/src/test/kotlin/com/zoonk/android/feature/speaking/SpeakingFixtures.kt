package com.zoonk.android.feature.speaking

import com.zoonk.api.ApiJson
import com.zoonk.api.models.SpeakingPaper

internal fun speakingPaper(
    access: String = "open",
    lastTry: String = "null",
): SpeakingPaper =
    ApiJson.decodeFromString(
        """
        {"exam":"dele","language":"es","level":"B2","paper":"Prueba 4","source":"https://examenes.cervantes.es/dele-b2","title":"DELE B2",
        "access":"$access","minutes":{"min":20,"max":20},"prepMinutes":20,"prepTasks":["1","2"],
        "tasks":[
          {"key":"1","minutes":{"min":6,"max":7},"mode":"monologueThenInteraction","name":"Valorar propuestas","options":2,"prepMinutes":10,
           "prepShared":{"minutes":20,"tasks":[1,2]},"role":"examiner","stimulus":"text",
           "criteria":[{"key":"fluency","name":"Fluidez"},{"key":"range","name":"Alcance"}],"lastTry":$lastTry},
          {"key":"2","minutes":{"min":5,"max":5},"mode":"monologue","name":"Describir una situación","options":1,"prepMinutes":0,
           "prepShared":null,"role":"partner","stimulus":"photos","criteria":[{"key":"accuracy","name":"Corrección"}],"lastTry":null}
        ]}
        """.trimIndent(),
    )

/** An exam task's `examTask` for a conversation. */
internal val EXAM_TASK =
    """
    {"exam":"dele","language":"es","level":"B2","paper":"Prueba 4","source":"https://examenes.cervantes.es/dele-b2","title":"DELE B2",
    "card":{"instructions":["Lee las propuestas."],"photos":[],"prompts":["¿Cuál prefieres?"],"summary":"Choose one of four proposals.",
     "table":null,"text":{"title":"Propuestas","body":"Una.\n\nDos."}},
    "criteria":[
      {"display":"band","halfBands":false,"key":"fluency","levelBand":2,"levelMark":2,"maxBand":3,"name":"Fluidez","points":null,"sound":true,"voiceOnly":false},
      {"display":"band","halfBands":false,"key":"range","levelBand":2,"levelMark":2,"maxBand":3,"name":"Alcance","points":null,"sound":false,"voiceOnly":false}
    ],
    "cues":[],"nextTask":"2","number":1,"sectionId":null,
    "task":{"key":"1","minutes":{"min":6,"max":7},"mode":"monologueThenInteraction","name":"Valorar propuestas","options":2,"prepMinutes":10,
     "prepShared":null,"role":"examiner","stimulus":"text"},
    "taskCount":4}
    """.trimIndent()
