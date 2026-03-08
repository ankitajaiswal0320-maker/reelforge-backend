global.File = class File {};

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const sharp = require("sharp");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("/tmp"));

/* ---------------- ASIN EXTRACTOR ---------------- */

function extractASIN(url) {
  const match = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
  return match ? match[1] : null;
}

/* ---------------- AMAZON SCRAPER ---------------- */

async function getAmazonProduct(url) {

  const asin = extractASIN(url);
  if (!asin) throw new Error("Invalid Amazon URL");

  const cleanUrl = `https://www.amazon.in/dp/${asin}`;

  const { data } = await axios.get(cleanUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const $ = cheerio.load(data);

  const title =
    $("#productTitle").text().trim() ||
    $("h1 span").first().text().trim();

  const rating = $(".a-icon-alt").first().text().trim();

  const features = [];

  $("#feature-bullets li").each((i, el) => {
    const text = $(el).text().trim();
    if (text) features.push(text);
  });

  const images = [];

  $("script").each((i, el) => {
    const script = $(el).html();

    if (script && script.includes("ImageBlockATF")) {

      const matches = script.match(/"hiRes":"(.*?)"/g);

      if (matches) {
        matches.forEach(img => {
          const clean = img.replace('"hiRes":"', "").replace('"', "");
          images.push(clean);
        });
      }

    }
  });

  return {
    title,
    rating,
    features: features.slice(0, 4),
    images: images.slice(0, 3)
  };

}

/* ---------------- IMAGE DOWNLOAD ---------------- */

async function downloadImage(url, index) {

  const filePath = `/tmp/img${index}.jpg`;

  const response = await axios({
    url,
    responseType: "arraybuffer"
  });

  await sharp(response.data)
    .resize(900, 1600, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toFile(filePath);

  return filePath;

}

/* ---------------- ROOT ---------------- */

app.get("/", (req, res) => {
  res.send("ReelForge API running");
});

/* ---------------- VIDEO GENERATOR ---------------- */

app.post("/generate-video", async (req, res) => {

  try {

    const productUrl = req.body.url;

    if (!productUrl) {
      return res.status(400).json({ error: "Product URL missing" });
    }

    const product = await getAmazonProduct(productUrl);

    const title = product.title;
    const rating = product.rating;
    const features = product.features;
    const images = product.images;

    if (!title || images.length === 0) {
      return res.status(400).json({ error: "Product data missing" });
    }

    /* -------- DOWNLOAD IMAGES -------- */

    const localImages = [];

    for (let i = 0; i < images.length; i++) {
      const img = await downloadImage(images[i], i);
      localImages.push(img);
    }

    while (localImages.length < 3) {
      localImages.push(localImages[0]);
    }

    /* -------- GENERATE SCENES -------- */

    const scenes = [];

    scenes.push(`Looking for a good ${title}?`);

    if (rating) {
      scenes.push(`This product is rated ${rating}`);
    }

    features.slice(0, 2).forEach(f => scenes.push(f));

    scenes.push(`Check the link in description`);

    while (scenes.length < 5) {
      scenes.push(`Great product for your home`);
    }

    /* -------- CLEAN TEXT -------- */

    const cleanScenes = scenes.map(s =>
      s
        .replace(/['":]/g, "")
        .replace(/[()]/g, "")
        .replace(/&/g, "and")
        .replace(/\n/g, " ")
        .substring(0, 90)
    );

    const output = "/tmp/video.mp4";

    /* -------- FFMPEG COMMAND -------- */

    const command = `
ffmpeg -y \
-loop 1 -t 4 -i "${localImages[0]}" \
-loop 1 -t 4 -i "${localImages[1]}" \
-loop 1 -t 4 -i "${localImages[2]}" \
-loop 1 -t 4 -i "${localImages[0]}" \
-loop 1 -t 4 -i "${localImages[1]}" \
-filter_complex "
[0:v]zoompan=z='min(zoom+0.0015,1.5)':d=100,scale=720:1280,drawtext=text='${cleanScenes[0]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200[v0];
[1:v]zoompan=z='min(zoom+0.0015,1.5)':d=100,scale=720:1280,drawtext=text='${cleanScenes[1]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200[v1];
[2:v]zoompan=z='min(zoom+0.0015,1.5)':d=100,scale=720:1280,drawtext=text='${cleanScenes[2]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200[v2];
[3:v]zoompan=z='min(zoom+0.0015,1.5)':d=100,scale=720:1280,drawtext=text='${cleanScenes[3]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200[v3];
[4:v]zoompan=z='min(zoom+0.0015,1.5)':d=100,scale=720:1280,drawtext=text='${cleanScenes[4]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200[v4];
[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0
" \
-c:v libx264 -preset ultrafast \
-pix_fmt yuv420p \
${output}
`;

    const ffmpeg = spawn("bash", ["-c", command]);

    ffmpeg.stderr.on("data", data => {
      console.log(data.toString());
    });

    ffmpeg.on("close", code => {

      if (code !== 0) {
        return res.status(500).json({ error: "Video generation failed" });
      }

      res.json({
        status: "success",
        videoUrl: `${req.protocol}://${req.get("host")}/video.mp4`
      });

    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Internal server error" });

  }

});

/* ---------------- SERVER ---------------- */

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
