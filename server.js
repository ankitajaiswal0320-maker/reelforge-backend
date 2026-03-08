const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReelForge Video API Running");
});

app.post("/generate-video", (req, res) => {
  const { text } = req.body;

  console.log("Received request:", text);

  res.json({
    status: "success",
    message: "Video generation started",
    videoUrl: "/sample-video.mp4"
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
