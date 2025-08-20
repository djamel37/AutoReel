const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVEN_API_KEY) throw new Error("ELEVENLABS_API_KEY is missing");

async function elevenTTS(text) {
  console.log("  🎤 Sending text to ElevenLabs TTS...");
  const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": ELEVEN_API_KEY
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("ElevenLabs TTS failed: " + errText);
  }

  const buffer = await response.arrayBuffer();
  const filePath = path.join("files", `audio_${Date.now()}.mp3`);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  console.log("  ✅ Audio saved at:", filePath);
  return filePath;
}

module.exports = { elevenTTS };
