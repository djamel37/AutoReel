// AutoReel Pro — Backend
// Generates TTS via ElevenLabs, fetches stock video from Pexels,
// converts to 1080x1920 vertical if needed, and merges audio+video.

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Ensure ffmpeg binary path (works on Render)
ffmpeg.setFfmpegPath(ffmpegPath);

// --- Config / Paths ---
const PORT = process.env.PORT || 3000;
const TMP_DIR = process.env.TMP_DIR || "/tmp"; // Render has /tmp writable
const FILES_DIR = path.join(TMP_DIR, "autoreel");
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// Serve generated files statically
app.use("/files", express.static(FILES_DIR, { maxAge: "1h" }));

// --- Health ---
app.get("/", (_req, res) => {
  res.send("✅ AutoReel Pro server is running.");
});

// --- Helpers ---
const uid = () => Math.random().toString(36).slice(2, 10);

async function downloadToFile(url, dest) {
  const resp = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(dest, resp.data);
  return dest;
}

async function elevenTTS(text) {
  const key = process.env.ELEVEN_API_KEY;
  const voiceId = process.env.ELEVEN_VOICE_ID; // e.g. "EXAVITQu4vr4xnSDxMaL"
  if (!key || !voiceId) throw new Error("Missing ELEVEN_API_KEY or ELEVEN_VOICE_ID");

  const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const resp = await axios.post(
    ttsUrl,
    {
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.7 }
    },
    {
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json"
      },
      responseType: "arraybuffer"
    }
  );

  const audioPath = path.join(FILES_DIR, `voice-${uid()}.mp3`);
  fs.writeFileSync(audioPath, resp.data);
  return audioPath;
}

async function pexelsVideo(query) {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) throw new Error("Missing PEXELS_API_KEY");

  // Prefer vertical clips if available; fallback to any
  const resp = await axios.get("https://api.pexels.com/videos/search", {
    headers: { Authorization: pexelsKey },
    params: {
      query: query || "abstract background",
      per_page: 5,
      orientation: "portrait" // hint; Pexels may ignore sometimes
    }
  });

  const videos = resp?.data?.videos || [];
  if (!videos.length) throw new Error("No videos found from Pexels");

  // Pick the best (prefer ~1080x1920)
  let file = null;
  for (const v of videos) {
    const vf =
      (v.video_files || []).find(f => f.width === 1080 && f.height === 1920) ||
      (v.video_files || []).find(f => f.quality === "hd") ||
      (v.video_files || [])[0];
    if (vf) {
      file = vf;
      break;
    }
  }
  if (!file) throw new Error("No video_files in Pexels response");

  const videoPath = path.join(FILES_DIR, `video-${uid()}.mp4`);
  await downloadToFile(file.link, videoPath);
  return { videoPath, width: file.width, height: file.height };
}

function toVertical1080x1920(inputPath, inputW, inputH) {
  // If already 1080x1920, just return input
  if (inputW === 1080 && inputH === 1920) return Promise.resolve(inputPath);

  const outPath = path.join(FILES_DIR, `vertical-${uid()}.mp4`);

  // Strategy: scale to fit width 1080, then pad/crop to 1920 height centered.
  // This preserves aspect as much as possible.
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        "scale=1080:-2", // scale width=1080, height auto, even
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black", // pad to 1080x1920 center
        "crop=1080:1920" // ensure exact size
      ])
      .outputOptions([
        "-c:v libx264",
        "-preset veryfast",
        "-crf 23",
        "-pix_fmt yuv420p"
      ])
      .noAudio()
      .save(outPath)
      .on("end", () => resolve(outPath))
      .on("error", reject);
  });
}

function mergeAV(videoPath, audioPath) {
  const outPath = path.join(FILES_DIR, `reel-${uid()}.mp4`);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v libx264",
        "-preset veryfast",
        "-crf 23",
        "-c:a aac",
        "-b:a 192k",
        "-shortest"
      ])
      .save(outPath)
      .on("end", () => resolve(outPath))
      .on("error", reject);
  });
}

// --- Main endpoint ---
// POST /api/generate { text: string, query?: string }
app.post("/api/generate", async (req, res) => {
  const { text, query } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    // 1) TTS
    const audioPath = await elevenTTS(text.trim());

    // 2) Video
    const { videoPath, width, height } = await pexelsVideo(query || text);

    // 3) Ensure 1080x1920 vertical
    const verticalPath = await toVertical1080x1920(videoPath, width, height);

    // 4) Merge A+V
    const finalPath = await mergeAV(verticalPath, audioPath);

    // 5) Give a public URL
    const fileName = path.basename(finalPath);
    const base = `${req.protocol}://${req.get("host")}`;
    const videoUrl = `${base}/files/${fileName}`;

    // Optional cleanup of intermediates (keep final only)
    try {
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (videoPath && fs.existsSync(videoPath) && videoPath !== verticalPath) fs.unlinkSync(videoPath);
      if (verticalPath && fs.existsSync(verticalPath) && verticalPath !== finalPath) fs.unlinkSync(verticalPath);
    } catch (_) {}

    return res.json({ ok: true, videoUrl });
  } catch (err) {
    console.error("Generate error:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "Failed to generate reel. Check your API keys and logs."
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AutoReel Pro server listening on :${PORT}`);
});
