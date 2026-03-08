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

/* ---------------- TEXT CLEANER ---------------- */

function cleanText(text) {
  return text
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80);
}

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
    title: cleanText(title),
    features: features.map(f => cleanText(f)).slice(0,3),
    images: images.slice(0,5)
  };

}

/* ---------------- SCENE GENERATOR ---------------- */

function generateScenes(product) {

  const title = product.title;

  const scenes = [];

  scenes.push(`Unboxing the ${title}`);
  scenes.push(`Setting up the ${title}`);
  scenes.push(`Using the ${title} in daily life`);

  if(product.features[0])
    scenes.push(product.features[0]);
  else
    scenes.push(`Premium design and quality`);

  scenes.push(`Final look at the ${title}`);

  return scenes.slice(0,5);

}

/* ---------------- DOWNLOAD IMAGES ---------------- */

async function downloadImages(urls) {

  const images = [];

  for (let i = 0; i < urls.length; i++) {

    const response = await axios.get(urls[i], {
      responseType: "arraybuffer"
    });

    const file = `/tmp/scene${i}.jpg`;

    fs.writeFileSync(file, response.data);

    images.push(file);

  }

  return images;

}

/* ---------------- VIDEO RENDER ---------------- */

function renderVideo(images, scenes, req, res) {

  const output = "/tmp/video.mp4";

  const cmd = `
ffmpeg -y \
-loop 1 -t 5 -i "${images[0]}" \
-loop 1 -t 5 -i "${images[1]}" \
-loop 1 -t 5 -i "${images[2]}" \
-loop 1 -t 5 -i "${images[3]}" \
-loop 1 -t 5 -i "${images[4]}" \
-filter_complex "

[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,
zoompan=z='min(zoom+0.0015,1.4)':d=125,
drawtext=text='${scenes[0]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200:box=1:boxcolor=black@0.5[v0];

[1:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,
zoompan=z='min(zoom+0.0015,1.4)':d=125,
drawtext=text='${scenes[1]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200:box=1:boxcolor=black@0.5[v1];

[2:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,
zoompan=z='min(zoom+0.0015,1.4)':d=125,
drawtext=text='${scenes[2]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200:box=1:boxcolor=black@0.5[v2];

[3:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,
zoompan=z='min(zoom+0.0015,1.4)':d=125,
drawtext=text='${scenes[3]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200:box=1:boxcolor=black@0.5[v3];

[4:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,
zoompan=z='min(zoom+0.0015,1.4)':d=125,
drawtext=text='${scenes[4]}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h-200:box=1:boxcolor=black@0.5[v4];

[v0][v1]xfade=transition=fade:duration=1:offset=4[v01];
[v01][v2]xfade=transition=fade:duration=1:offset=8[v02];
[v02][v3]xfade=transition=fade:duration=1:offset=12[v03];
[v03][v4]xfade=transition=fade:duration=1:offset=16
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

    res.status(500).json({
      error: "Video generation failed"
    });

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
