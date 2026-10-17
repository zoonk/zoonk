import { Activity, useState } from "react";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";

/** Cache Components hides an Activity's effects while retaining its editor and recorder state. */
export function RetainedLesson() {
  const [visible, setVisible] = useState(true);

  return (
    <>
      <button onClick={() => setVisible((current) => !current)} type="button">
        {visible ? "Hide lesson" : "Show lesson"}
      </button>
      <Activity mode={visible ? "visible" : "hidden"}>
        <LessonPlayerShell />
      </Activity>
    </>
  );
}
