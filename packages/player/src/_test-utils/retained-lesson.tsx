import { Activity, useState } from "react";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";

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
