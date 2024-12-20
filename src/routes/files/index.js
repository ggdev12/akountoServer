const express = require("express");
const router = express.Router();
const { upload } = require("./../../services/storage");

// Route to upload a file
router.post("/upload", upload.single("file"), function (req, res, next) {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  // Return the file URL
  res.send({
    message: "File uploaded successfully",
    url: req.file.location,
  });
});

module.exports = router;
