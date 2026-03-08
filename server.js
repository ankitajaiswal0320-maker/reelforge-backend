global.File = class File {};

const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const axios = require("axios");
const cheerio = require("cheerio");

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

  try {

    const asin = extractASIN(url);

    if (!asin) {
      throw new Error("Invalid Amazon URL");
    }

    const cleanUrl = `https://www.amazon.in/dp/${asin}`;

    const { data } = await axios.get(cleanUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const $ = cheerio.load(data);

    const title =
      $("#productTitle").text().trim() ||
      $('meta[name="title"]').attr("content") ||
      $("h1 span").first().text().trim();

    const price =
      $("#priceblock_ourprice").text().trim() ||
      $("#priceblock_dealprice").text().trim() ||
      $(".a-price .a-offscreen").first().text().trim();

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
      price,
      rating,
      features: features.slice(0,4),
      images: images.slice(0,3)
    };

  } catch (err) {

    console.error("Amazon scraping failed:", err.message);

    return {
      title: "",
      price: "",
      rating: "",
      features: [],
      images: []
    };

  }
}

/* ---------------- ROOT ROUTE ---------------- */

app.get("/", (req, res) => {
  res.send("ReelForge API is running");
});

/* ---------------- VIDEO GENERATOR ---------------- */

app.post("/generate-video", async (req, res) => {

  try {

    const productUrl = req.body.url;

    if (!productUrl) {
      return res.status(400).json({ error: "Product URL missing" });
    }

    const product = await getAmazonProduct(productUrl);

    const images = product.images;
    const title = product.title;
    const features = product.features;
    const price = product.price;
    const rating = product.rating;

    if (!title) {
      return res.status(400).json({ error: "Could not extract product data" });
    }

    let script =
      req.body.script ||
      `${title}. Rated ${rating}. Price ${price}. ${features.join(". ")}`;

    if (images.length === 0) {
      return res.status(400).json({ error: "No product images found" });
    }

    while (images.length < 3) {
      images.push(images[0]);
    }

    script = script.replace(/['":?]/g, "");

    const output = "/tmp/video.mp4";

    const command = `ffmpeg -y \
-loop 1 -t 3 -i "${images[0]}" \
-loop 1 -t 3 -i "${images[1]}" \
-loop 1 -t 3 -i "${images[2]}" \
-filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0" \
-vf "scale=720:1280,drawtext=text='${script}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-200" \
-c:v libx264 ${output}`;

    exec(command, (err) => {

      if (err) {
        console.error("FFmpeg error:", err);
        return res.status(500).json({ error: "Video generation failed" });
      }

      res.json({
        status: "success",
        videoUrl: `${req.protocol}://${req.get("host")}/video.mp4`
      });

    });

  } catch (error) {

    console.error("Server error:", error);

    res.status(500).json({ error: "Internal server error" });

  }

});

/* ---------------- SERVER ---------------- */

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
