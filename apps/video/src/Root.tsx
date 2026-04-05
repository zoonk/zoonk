import { Composition, Folder } from "remotion";
import { FPS } from "./lib/constants";
import { loadGeistFonts } from "./lib/fonts";
import { LaunchVideo } from "./videos/launch/composition";
import { SCENES } from "./videos/launch/constants";
import { launchVideoSchema } from "./videos/launch/schema";

loadGeistFonts();

/** Derived from scene durations so it stays in sync automatically. */
const DURATION_IN_FRAMES = Object.values(SCENES).reduce((sum, frames) => sum + frames, 0);

export const RemotionRoot = () => {
  return (
    <Folder name="Launch">
      <Composition
        id="LaunchVideo-EN"
        component={LaunchVideo}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        schema={launchVideoSchema}
        defaultProps={{ locale: "en" }}
      />
      <Composition
        id="LaunchVideo-PT-BR"
        component={LaunchVideo}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        schema={launchVideoSchema}
        defaultProps={{ locale: "pt-br" }}
      />
    </Folder>
  );
};
