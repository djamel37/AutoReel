import express from "express";
import axios from "axios";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import FormData from "form-data";

const app = express();
app.use(express.json());

ffmpeg.setFfmpegPath(ffmpegPath);

// نقطة اختبار
app.get("/", (req, res) => {
  res.send("✅ AutoReel server is running!");
});

// توليد فيديو تجريبي
app.post("/generate", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    // فيديو تجريبي (لاحقًا نستخدم Pexels API)
    const videoUrl = "https://player.vimeo.com/external/341531664.sd.mp4?s=2bb";

    res.json({
      message: "Server working 🚀",
      receivedText: text,
      videoUrl: videoUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
