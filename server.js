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
    features: features.slice(0,4),
    images: images.slice(0,3)
  };

}

/* ---------------- SCRIPT GENERATOR ---------------- */

function generateScenes(product){

  const scenes=[];

  scenes.push(`Looking for a good ${product.title}?`);

  if(product.rating){
    scenes.push(`This product is rated ${product.rating}`);
  }

  product.features.slice(0,2).forEach(f=>{
    scenes.push(f);
  });

  scenes.push(`Check link in description for latest price`);

  while(scenes.length<5){
    scenes.push(`Great product for your home`);
  }

  return scenes;

}

/* ---------------- TEXT CLEANER ---------------- */

function cleanScenes(scenes){

  return scenes.map(s=>
    s
    .replace(/['":]/g,"")
    .replace(/[()]/g,"")
    .replace(/&/g,"and")
    .replace(/\n/g," ")
    .substring(0,120)
  );

}

/* ---------------- TEXT WRAP ---------------- */

function wrapText(text,maxLen=28){

  const words=text.split(" ");
  let line="";
  let lines=[];

  words.forEach(word=>{

    if((line+word).length>maxLen){
      lines.push(line.trim());
      line=word+" ";
    }else{
      line+=word+" ";
    }

  });

  lines.push(line.trim());

  return lines.join("\\n");

}

/* ---------------- IMAGE DOWNLOAD ---------------- */

async function downloadImage(url,index){

  const file=`/tmp/img${index}.jpg`;

  const response=await axios({
    url,
    responseType:"arraybuffer"
  });

  fs.writeFileSync(file,response.data);

  return file;

}

/* ---------------- VIDEO RENDER ---------------- */

function renderVideo(images,scenes,req,res){

  const output="/tmp/video.mp4";

  const command=`
ffmpeg -y \
-loop 1 -t 6 -i "${images[0]}" \
-loop 1 -t 6 -i "${images[1]}" \
-loop 1 -t 6 -i "${images[2]}" \
-loop 1 -t 6 -i "${images[0]}" \
-loop 1 -t 6 -i "${images[1]}" \
-filter_complex "
[0:v]scale=720:1280,drawtext=text='${scenes[0]}':fontcolor=white:fontsize=44:line_spacing=10:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5:boxborderw=20[v0];
[1:v]scale=720:1280,drawtext=text='${scenes[1]}':fontcolor=white:fontsize=44:line_spacing=10:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5:boxborderw=20[v1];
[2:v]scale=720:1280,drawtext=text='${scenes[2]}':fontcolor=white:fontsize=44:line_spacing=10:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5:boxborderw=20[v2];
[3:v]scale=720:1280,drawtext=text='${scenes[3]}':fontcolor=white:fontsize=44:line_spacing=10:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5:boxborderw=20[v3];
[4:v]scale=720:1280,drawtext=text='${scenes[4]}':fontcolor=white:fontsize=44:line_spacing=10:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5:boxborderw=20[v4];
[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0
" \
-c:v libx264 \
-preset ultrafast \
-pix_fmt yuv420p \
${output}
`;

  const ffmpeg=spawn("bash",["-c",command]);

  ffmpeg.stderr.on("data",data=>{
    console.log(data.toString());
  });

  ffmpeg.on("close",code=>{

    if(code!==0){
      return res.status(500).json({error:"Video generation failed"});
    }

    res.json({
      status:"success",
      videoUrl:`${req.protocol}://${req.get("host")}/video.mp4`
    });

  });

}

/* ---------------- API ---------------- */

app.post("/generate-video",async(req,res)=>{

  try{

    const product=await getAmazonProduct(req.body.url);

    let scenes=generateScenes(product);

    scenes=cleanScenes(scenes);

    scenes=scenes.map(s=>wrapText(s));

    const images=[];

    for(let i=0;i<3;i++){
      images.push(await downloadImage(product.images[i],i));
    }

    renderVideo(images,scenes,req,res);

  }

  catch(err){

    console.error(err);

    res.status(500).json({
      error:"Video generation failed"
    });

  }

});

/* ---------------- SERVER ---------------- */

app.get("/",(req,res)=>{
  res.send("ReelForge API running");
});

const PORT=3000;

app.listen(PORT,"0.0.0.0",()=>{
  console.log(`Server running on port ${PORT}`);
});
