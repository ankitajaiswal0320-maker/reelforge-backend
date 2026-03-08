
Ankita Jaiswal <ankitajaiswal0320@gmail.com>
2:10 PM (0 minutes ago)
to me

const express = require("express");
const { exec } = require("child_process");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReelForge Video API Running");
});

app.post("/generate-video", async (req, res) => {
  const { text } = req.body;

  const cmd = `ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=5 -vf "drawtext=text='${text}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2" output.mp4`;

  exec(cmd, (error) => {
    if (error) {
      return res.status(500).send("Video generation failed");
    }

    res.send("Video generated");
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
