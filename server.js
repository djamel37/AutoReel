// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { elevenTTS } = require("./elevenLabs");
const { pexelsVideo } = require("./pexels");
const { toVertical1080x1920 } = require("./videoUtils");
const { mergeAV } = require("./mergeAV");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== تفعيل CORS ======
app.use(cors());

// ====== Middleware ======
app.use(express.json());
app.use("/files", express.static(path.join(__dirname, "files"))); // استضافة الملفات النهائية

// ====== Main endpoint ======
app.post("/api/generate", async (req, res) => {
  const { text, query } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ ok: false, error: "Text is required" });

  try {
    // ===== Step 0: التأكد من وجود مجلد الملفات =====
    if (!fs.existsSync("files")) fs.mkdirSync("files");

    console.log("🔹 Step 1: Generating TTS audio...");
    const audioPath = await elevenTTS(text.trim());
    console.log("✅ Step 1: Audio generated at:", audioPath);

    console.log("🔹 Step 2: Fetching Pexels video...");
    const { videoPath, width, height } = await pexelsVideo(query || text);
    console.log("✅ Step 2: Video fetched at:", videoPath);

    console.log("🔹 Step 3: Converting video to 1080x1920 vertical...");
    const verticalPath = await toVertical1080x1920(videoPath, width, height);
    console.log("✅ Step 3: Video converted at:", verticalPath);

    console.log("🔹 Step 4: Merging audio + video...");
    const finalPath = await mergeAV(verticalPath, audioPath);
    console.log("✅ Step 4: Final video created at:", finalPath);

    const fileName = path.basename(finalPath);
    const base = `${req.protocol}://${req.get("host")}`;
    const videoUrl = `${base}/files/${fileName}`;

    // ===== Cleanup =====
    try {
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (videoPath && fs.existsSync(videoPath) && videoPath !== verticalPath) fs.unlinkSync(videoPath);
      if (verticalPath && fs.existsSync(verticalPath) && verticalPath !== finalPath) fs.unlinkSync(verticalPath);
    } catch (_) {}

    return res.json({ ok: true, videoUrl });
  } catch (err) {
    console.error("❌ Generate error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to generate reel. Check your API keys and logs." });
  }
});

// ====== Start server ======
app.listen(PORT, () => console.log(`🚀 AutoReel Pro server listening on :${PORT}`));
