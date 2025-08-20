// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { elevenTTS } = require("./elevenLabs"); // دالة تحويل النص لصوت
const { pexelsVideo } = require("./pexels");   // دالة جلب الفيديو
const { toVertical1080x1920 } = require("./videoUtils"); // تعديل الفيديو للعرض العمودي
const { mergeAV } = require("./mergeAV"); // دمج الصوت والفيديو

const app = express();
const PORT = process.env.PORT || 3000;

// ====== تفعيل CORS لجميع الدومينات ======
app.use(cors());

// ====== Middleware ======
app.use(express.json());
app.use("/files", express.static(path.join(__dirname, "files"))); // استضافة الملفات النهائية

// ====== Main endpoint ======
app.post("/api/generate", async (req, res) => {
  const { text, query } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ ok: false, error: "Text is required" });
  }

  try {
    // 1) تحويل النص لصوت
    const audioPath = await elevenTTS(text.trim());

    // 2) جلب الفيديو
    const { videoPath, width, height } = await pexelsVideo(query || text);

    // 3) تعديل الفيديو ليصبح 1080x1920 عمودي
    const verticalPath = await toVertical1080x1920(videoPath, width, height);

    // 4) دمج الصوت مع الفيديو
    const finalPath = await mergeAV(verticalPath, audioPath);

    // 5) إعطاء رابط عام للتحميل
    const fileName = path.basename(finalPath);
    const base = `${req.protocol}://${req.get("host")}`;
    const videoUrl = `${base}/files/${fileName}`;

    // تنظيف الملفات الوسيطة (اختياري)
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

// ====== Start server ======
app.listen(PORT, () => {
  console.log(`🚀 AutoReel Pro server listening on :${PORT}`);
});
