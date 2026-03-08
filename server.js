global.File = class File {};

const express = require("express")
const cors = require("cors")
const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const { spawn } = require("child_process")

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static("/tmp"))

/* ---------------- ASIN EXTRACTOR ---------------- */

function extractASIN(url){
const match = url.match(//([A-Z0-9]{10})(?:[/?]|$)/)
return match ? match[1] : null
}

/* ---------------- AMAZON SCRAPER ---------------- */

async function getAmazonProduct(url){

const asin = extractASIN(url)

if(!asin) throw new Error("Invalid Amazon URL")

const cleanUrl = "https://www.amazon.in/dp/${asin}"

const { data } = await axios.get(cleanUrl,{
headers:{
"User-Agent":"Mozilla/5.0",
"Accept-Language":"en-US,en;q=0.9"
}
})

const $ = cheerio.load(data)

const title =
$("#productTitle").text().trim() ||
$("h1 span").first().text().trim()

const features=[]

$("#feature-bullets li").each((i,el)=>{
const text=$(el).text().trim()
if(text) features.push(text)
})

return{
title,
features:features.slice(0,3)
}

}

/* ---------------- SCENE GENERATOR ---------------- */

function generateScenes(product){

const title = product.title.substring(0,60)

const scenes=[]

scenes.push("Unboxing the ${title}")
scenes.push("Placing the ${title} in a home environment")

product.features.forEach(f=>{
scenes.push("${title} showing feature ${f}")
})

scenes.push("Final clean setup with ${title}")

return scenes.slice(0,5)

}

/* ---------------- IMAGE PROMPTS ---------------- */

function generatePrompts(product, scenes){

const shortTitle = product.title.substring(0,40)

return scenes.map(scene =>
"POV smartphone photo, ${scene}, realistic lighting, home environment"
)

}

/* ---------------- IMAGE GENERATOR ---------------- */

async function generateImage(prompt,index){

try{

const response = await axios.post(
"https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2",
{ inputs: prompt },
{
headers:{
Authorization:"Bearer ${process.env.HF_API_KEY}",
"Content-Type":"application/json"
},
responseType:"arraybuffer",
timeout:120000
}
)

const file="/tmp/scene${index}.jpg"

fs.writeFileSync(file,response.data)

return file

}catch(err){

console.log("AI image failed, using fallback")

const fallback="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85"

const response = await axios.get(fallback,{responseType:"arraybuffer"})

const file="/tmp/scene${index}.jpg"

fs.writeFileSync(file,response.data)

return file

}

}

/* ---------------- GENERATE ALL IMAGES ---------------- */

async function createSceneImages(prompts){

const images=[]

for(let i=0;i<prompts.length;i++){

const img = await generateImage(prompts[i],i)

images.push(img)

}

return images

}

/* ---------------- VIDEO RENDER ---------------- */

function renderVideo(images,scenes,req,res){

const output="/tmp/video.mp4"

const cmd=`

ffmpeg -y \
-loop 1 -t 6 -i "${images[0]}" \
-loop 1 -t 6 -i "${images[1]}" \
-loop 1 -t 6 -i "${images[2]}" \
-loop 1 -t 6 -i "${images[3]}" \
-loop 1 -t 6 -i "${images[4]}" \
-filter_complex "

[0:v]scale=720:1280,zoompan=z='min(zoom+0.0015,1.5)':d=150,
drawtext=text='${scenes[0]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5[v0];

[1:v]scale=720:1280,zoompan=z='min(zoom+0.0015,1.5)':d=150,
drawtext=text='${scenes[1]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5[v1];

[2:v]scale=720:1280,zoompan=z='min(zoom+0.0015,1.5)':d=150,
drawtext=text='${scenes[2]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5[v2];

[3:v]scale=720:1280,zoompan=z='min(zoom+0.0015,1.5)':d=150,
drawtext=text='${scenes[3]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5[v3];

[4:v]scale=720:1280,zoompan=z='min(zoom+0.0015,1.5)':d=150,
drawtext=text='${scenes[4]}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-250:box=1:boxcolor=black@0.5[v4];

[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0
" \
-c:v libx264 -pix_fmt yuv420p ${output}

`

const ffmpeg = spawn("bash",["-c",cmd])

ffmpeg.stderr.on("data",data=>{
console.log(data.toString())
})

ffmpeg.on("close",code=>{

if(code!==0){
return res.status(500).json({error:"Video generation failed"})
}

res.json({
status:"success",
videoUrl:"${req.protocol}://${req.get("host")}/video.mp4"
})

})

}

/* ---------------- API ---------------- */

app.post("/generate-video",async(req,res)=>{

try{

const product = await getAmazonProduct(req.body.url)

const scenes = generateScenes(product)

const prompts = generatePrompts(product,scenes)

const images = await createSceneImages(prompts)

renderVideo(images,scenes,req,res)

}catch(err){

console.error(err)

res.status(500).json({error:"Video generation failed"})

}

})

/* ---------------- SERVER ---------------- */

app.get("/",(req,res)=>{
res.send("AI Product Video API Running")
})

const PORT=3000

app.listen(PORT,"0.0.0.0",()=>{
console.log("Server running on port ${PORT}")
})
