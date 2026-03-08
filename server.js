const express = require("express");
const cors = require("cors");

const app = express();

// Allow requests from anywhere
app.use(cors());
app.use(express.json());
app.use(express.static("/tmp"));

// Root route
app.get("/", (req, res) => {
  res.send("ReelForge API is running");
});

// Video endpoint
app.post("/generate-video", (req, res) => {

const script = req.body.generatedScript || "AI Product Review";
const output = "/tmp/video.mp4";

const command = `ffmpeg -y -f lavfi -i color=c=black:s=720x1280:d=6 \
-vf "drawtext=text='${script}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2" \
-c:v libx264 ${output}`;

exec(command, (err) => {

if (err) {
return res.status(500).json({ error: "Video generation failed" });
}

res.json({
status: "success",
videoUrl: "https://aware-creation-production-4ba6.up.railway.app/video.mp4"
});

});

});

// IMPORTANT: Railway port
const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port ${PORT}");
});
