import express from "express";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

ffmpeg.setFfmpegPath(ffmpegPath);

// ✅ توليد الصوت من ElevenLabs
async function generateVoice(text) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      voice_settings: { stability: 0.5, similarity_boost: 0.7 }
    })
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync("voice.mp3", buffer);
  return "voice.mp3";
}

// ✅ جلب فيديو من Pexels
async function getVideo(text) {
  const response = await axios.get("https://api.pexels.com/videos/search", {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    params: { query: text, per_page: 1 }
  });

  const videoUrl = response.data.videos[0].video_files[0].link;
  const videoPath = "video.mp4";
  const videoResp = await axios.get(videoUrl, { responseType: "arraybuffer" });
  fs.writeFileSync(videoPath, videoResp.data);
  return videoPath;
}

// ✅ دمج الصوت مع الفيديو
async function mergeAV(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions("-map 0:v", "-map 1:a", "-c:v copy", "-shortest")
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject);
  });
}

// ✅ API لإنشاء الريل
app.post("/generate", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const audio = await generateVoice(text);
    const video = await getVideo(text);
    const output = "final_reel.mp4";

    await mergeAV(video, audio, output);

    res.download(output);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate reel" });
  }
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
