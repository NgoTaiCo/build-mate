import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Codec: H.264 for maximum offline compatibility
Config.setCodec("h264");
// CRF 18 = high quality, reasonable file size
Config.setCrf(18);

// Use system Chrome if the Remotion headless shell is not available.
// macOS: set via CLI flag --browser-executable or env REMOTION_BROWSER_EXECUTABLE
// Override on your machine if Chrome is in a different path.
