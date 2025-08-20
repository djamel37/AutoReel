const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is missing");

async function pexelsVideo(query) {
  console.log("  🎥 Searching Pexels videos for query:", query);
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`, {
    headers: { Authorization: PEXELS_API_KEY }
  });

  const data = await res.json();
  if (!data.videos || data.videos.length === 0) throw new Error("No videos found");

  const videoUrl = data.videos[0].video_files[0].link;
  const videoPath = path.join("files", `video_${Date.now()}.mp4`);
  const videoRes = await fetch(videoUrl);
  const buffer = await videoRes.arrayBuffer();
  fs.writeFileSync(videoPath, Buffer.from(buffer));
  console.log("  ✅ Video saved at:", videoPath);
  return { videoPath, width: data.videos[0].width, height: data.videos[0].height };
}

module.exports = { pexelsVideo };
