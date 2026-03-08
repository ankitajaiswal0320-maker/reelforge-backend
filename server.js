const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "ReelForge API working"
  });
});

app.post("/generate-video", (req, res) => {
  res.json({
    status: "success",
    videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4"
  });
});

const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
