const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

async function toVertical1080x1920(inputPath, width, height) {
  return new Promise((resolve, reject) => {
    try {
      const outputPath = path.join("files", `vertical_${Date.now()}.mp4`);

      ffmpeg(inputPath)
        .videoFilters([
          {
            filter: "scale",
            options: {
              w: 1080,
              h: 1920,
              force_original_aspect_ratio: "decrease"
            }
          },
          {
            filter: "pad",
            options: {
              w: 1080,
              h: 1920,
              x: "(ow-iw)/2",
              y: "(oh-ih)/2",
              color: "black"
            }
          }
        ])
        .outputOptions("-movflags +faststart")
        .save(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { toVertical1080x1920 };
