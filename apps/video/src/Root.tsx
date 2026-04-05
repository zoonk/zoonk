import "./index.css";
import { Composition } from "remotion";
import { LaunchVideo } from "./compositions/launch";
import { launchVideoSchema } from "./compositions/launch/schema";
import { FPS } from "./lib/constants";
import { loadGeistFonts } from "./lib/fonts";

loadGeistFonts();

export const RemotionRoot = () => {
  return (
    <Composition
      id="LaunchVideo"
      component={LaunchVideo}
      durationInFrames={2040}
      fps={FPS}
      width={1920}
      height={1080}
      schema={launchVideoSchema}
      defaultProps={{}}
    />
  );
};
