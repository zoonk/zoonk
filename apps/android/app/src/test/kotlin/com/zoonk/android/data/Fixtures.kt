package com.zoonk.android.data

import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.MeResponse

/** Account ids are UUIDs in the contract. */
internal const val ANA = "0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0a1"
internal const val BIA = "0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0b2"
internal const val GUEST = "0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0c3"

internal fun account(id: String): MeResponse =
    ApiJson.decodeFromString(
        """
        {"account":{"deletion":{"hasAppleAccount":false},"hasActiveSubscription":false,"subscription":null},
         "user":{"analyticsDisabled":false,"createdAt":"2026-10-28T12:00:00.000Z","displayUsername":null,
         "email":"$id@zoonk.test","emailVerified":true,"id":"$id","image":null,"name":"Learner",
         "updatedAt":"2026-10-28T12:00:00.000Z","username":null}}
        """.trimIndent(),
    )

internal fun summary(
    readAt: Long,
    nextChangeAt: Long,
): LearnerSummary =
    ApiJson.decodeFromString(
        """
        {"account":{"email":"ana@zoonk.test","image":null,"name":"Ana"},"activeGoalId":null,
         "analytics":{"disabled":false,"goal":null,"plan":"free","username":null},
         "buddy":{"beltColor":"white","energy":null,"glasses":"round","kind":"zu","name":null,"studiedToday":false},
         "day":null,"goals":[],
         "identity":{"expiresAt":1793186000000,"isAnonymous":false,"signedInAt":1761650000000,"userId":"$ANA"},
         "level":null,"missions":null,"nextChangeAt":$nextChangeAt,
         "places":{"exam":false,"mindMaps":false,"readyMistakes":0,"speaking":false},
         "readAt":$readAt,"tier":"free","timeZone":null,"today":null}
        """.trimIndent(),
    )
