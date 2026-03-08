global.File = class File {};

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
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

  const features = [];

  $("#feature-bullets li").each((i, el) => {
    const txt = $(el).text().trim();
    if (txt) features.push(txt);
  });

  const images = [];

  $("script").each((i, el) => {

    const script = $(el).html();

    if (script && script.includes("ImageBlockATF")) {

      const matches = script.match(/"hiRes":"(.*?)"/g);

      if (matches) {

        matches.forEach(img => {

          const clean = img
            .replace('"hiRes":"', "")
            .replace('"', "");

          images.push(clean);

        });

      }

    }

  });

  /* ensure at least 5 images */

  while (images.length < 5 && images.length > 0) {
    images.push(images[0]);
  }

  return {
    title,
    features: features.slice(0, 3),
    images: images.slice(0, 5)
  };

}

/* ---------------- SCENE GENERATOR ---------------- */

function generateScenes(product) {

  const shortTitle = product.title.substring(0, 60);

  const scenes = [];

  scenes.push(`Unboxing the ${shortTitle}`);
  scenes.push(`Placing the ${shortTitle} in living room`);

  product.features.forEach(f => {
    scenes.push(f.substring(0, 60));
  });

  scenes.push(`Final clean setup with ${shortTitle}`);

  /* sanitize text */

  const safeScenes = scenes.map(s =>
    s.replace(/['":]/g, "")
      .replace(/\n/g, " ")
      .substring(0, 80)
  );

  return safeScenes.slice(0, 5);

}

/* ---------------- IMAGE DOWNLOADER ---------------- */

async function downloadImages(imageUrls) {

  const files = [];

  for (let i = 0; i < imageUrls.length; i++) {

    const res = await axios.get(imageUrls[i], {
      responseType: "arraybuffer"
    });

    const file = `/tmp/img${i}.jpg`;

    fs.writeFileSync(file, res.data);

    files.push(file);

  }

  return files;

}

/* ---------------- VIDEO RENDER ---------------- */

function renderVideo(images, scenes, req, res) {

  const output = "/tmp/video.mp4";

  const cmd = `
ffmpeg -loglevel error -y \
-loop 1 -t 3 -i "${images[0]}" \
-loop 1 -t 3 -i "${images[1]}" \
-loop 1 -t 3 -i "${images[2]}" \
-loop 1 -t 3 -i "${images[3]}" \
-loop 1 -t 3 -i "${images[4]}" \
-filter_complex "
[0:v]scale=720:1280,force_original_aspect_ratio=text='${scenes[0]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-200[v0];
[1:v]scale=720:1280,force_original_aspect_ratio=text='${scenes[1]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-200[v1];
[2:v]scale=720:1280,force_original_aspect_ratio=text='${scenes[2]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-200[v2];
[3:v]scale=720:1280,force_original_aspect_ratio=text='${scenes[3]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-200[v3];
[4:v]scale=720:1280,force_original_aspect_ratio=text='${scenes[4]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-200[v4];
[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0
" \
-c:v libx264 -pix_fmt yuv420p ${output}
`;

  const ffmpeg = spawn("bash", ["-c", cmd]);

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

}

/* ---------------- API ---------------- */

app.post("/generate-video", async (req, res) => {

  try {

    const product = await getAmazonProduct(req.body.url);

    const scenes = generateScenes(product);

    const images = await downloadImages(product.images);

    renderVideo(images, scenes, req, res);

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: "Video generation failed" });

  }

});

/* ---------------- SERVER ---------------- */

app.get("/", (req, res) => {
  res.send("AI Product Video API Running");
});

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
