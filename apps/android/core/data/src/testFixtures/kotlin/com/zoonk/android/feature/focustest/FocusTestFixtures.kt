package com.zoonk.android.feature.focustest

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudySessionStore

/** For screens whose Focus test switches a test doesn't tap. */
fun unusedFocusTests(cache: AppCache) =
    FocusTestStore(
        api = { _, _, _ -> error("Not used") },
        cache = cache,
        sessions = StudySessionStore(FakeStudyApi(), cache) { "UTC" },
        summary = cache.resource(Audience.SignedIn, emptySet()) { null },
        timeZone = { "UTC" },
    )
