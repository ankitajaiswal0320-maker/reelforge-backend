global.File = class File {};

const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

// Allow requests from anywhere
app.use(cors());
app.use(express.json());
app.use(express.static("/tmp"));

async function getAmazonImages(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });

  const $ = cheerio.load(data);

  const images = [];

  $("img").each((i, el) => {
    const src = $(el).attr("src");

    if (src && src.includes("images")) {
      images.push(src);
    }
  });

  return images.slice(0, 3);
}

// Root route
app.get("/", (req, res) => {
  res.send("ReelForge API is running");
});

// Video endpoint
app.post("/generate-video", async(req, res) => {
  
let script = req.body.script || req.body.generatedScript || "AI Product Review";
const productUrl = req.body.url;
const images = await getAmazonImages(productUrl);
script = script.replace(/['":?]/g, "");
const output = "/tmp/video.mp4";

const command = `
ffmpeg -y \
-loop 1 -t 3 -i ${images[0]} \
-loop 1 -t 3 -i ${images[1]} \
-loop 1 -t 3 -i ${images[2]} \
-filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0" \
-vf "drawtext=text='${script}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-200" \
-c:v libx264 ${output}
`;

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
