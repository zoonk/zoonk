package com.zoonk.android.feature.session

import com.zoonk.api.models.StudyBlockCompletion

/** What the block earned itself (main's `getOwnBrainPower`): the day's bonus it paid belongs to the day's moment. */
val StudyBlockCompletion.ownBrainPower: Long get() = brainPower - if (fullMeal.paid) fullMeal.bonus else 0
