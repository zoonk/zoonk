package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.Plan
import com.zoonk.api.models.Syllabus

internal const val GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"
internal const val PLAN_ID = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a02"

/** The fewest fields a plan reads with; [extra] adds or replaces top-level ones. */
internal fun plan(extra: String = ""): Plan =
    ApiJson.decodeFromString(
        """
        {"access":{"freeWeekOver":false,"mocksRequirePlus":false},"areas":[],"changes":[],
         "estimate":{"remainingHours":10,"totalHours":12},"examChoices":[],"examDocument":"guide",
         "fundedMocks":[],"goalId":"$GOAL","phases":[],"planId":"$PLAN_ID","ready":true,
         "schedule":{"dailyMinutes":20,"fullCourse":false,"lightWeeks":[],"studyDays":5,
          "targetDateEstimated":false,"targetDateNamedMonth":false,"weekdayMinutes":[0,20,20,20,20,20,0]},
         "steering":{"difficultyBias":"standard","lessonsStudied":0,"practiceBias":"balanced","skippedActivities":[]},
         "tools":[],"week":{"days":[],"endDate":"2026-11-01","startDate":"2026-10-26"},
         "weekTime":{"studiedMinutes":0,"targetMinutes":100}${if (extra.isEmpty()) "" else ",$extra"}}
        """.trimIndent(),
    )

internal fun syllabus(): Syllabus =
    ApiJson.decodeFromString(
        """
        {"examDocument":"guide","fromMaterial":false,"goal":{"id":"$GOAL","kind":"learn","title":"Learn Python"},
         "kind":"modules","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":0},"subjects":[],
         "topicCount":0,"topicsMapped":true}
        """.trimIndent(),
    )
