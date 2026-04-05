import "./index.css";
import { Composition, Folder } from "remotion";
import { LaunchVideo } from "./compositions/launch";
import { launchVideoSchema } from "./compositions/launch/schema";
import { FPS } from "./lib/constants";
import { loadGeistFonts } from "./lib/fonts";

loadGeistFonts();

const DURATION_IN_FRAMES = 2010;

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
