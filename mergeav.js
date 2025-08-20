const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

async function mergeAV(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    try {
      const outputPath = path.join("files", `final_${Date.now()}.mp4`);

      ffmpeg(videoPath)
        .input(audioPath)
        .outputOptions([
          "-c:v copy",   // احتفظ بالفيديو كما هو
          "-c:a aac",    // تحويل الصوت إلى AAC
          "-shortest"    // الفيديو يتوقف عند نهاية الصوت
        ])
        .save(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { mergeAV };
