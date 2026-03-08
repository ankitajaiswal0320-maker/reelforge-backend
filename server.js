const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReelForge Video API Running");
});

app.post("/generate-video", (req, res) => {
  res.json({
    status: "success",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
