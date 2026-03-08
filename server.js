const express = require("express");
const cors = require("cors");

const app = express();

// Allow requests from anywhere
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("ReelForge API is running");
});

// Video endpoint
const { exec } = require("child_process");

app.post("/generate-video", (req, res) => {

const output = "video.mp4";

exec(`ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=5 -vf "drawtext=text='ReelForge AI Review':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2" ${output}`, (err) => {

if (err) {
return res.status(500).json({ error: "Video generation failed" });
}

res.json({
status: "success",
videoUrl: `https://aware-creation-production-4ba6.up.railway.app/${output}`
});

});

});

// IMPORTANT: Railway port
const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port ${PORT}");
});
