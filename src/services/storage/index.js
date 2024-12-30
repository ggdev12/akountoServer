const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const uuidv4 = require("uuid").v4;
const https = require("https");

const Bucket = "akountofiles";

// Create a basic HTTPS agent
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  timeout: 60000,
});

// Simplify AWS configuration
AWS.config = new AWS.Config({
  accessKeyId: "WN72022TEDXURTSOTLPJ",
  secretAccessKey: "XNpSWyTXp018YREiXiaZ9T2qJGN5SsZEyBR7vvYg",
  endpoint: "https://del1.vultrobjects.com",
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  httpOptions: { agent },
});

// Create S3 instance with specific configuration
const s3 = new AWS.S3({
  maxRetries: 5,
  logger: console,
  computeChecksums: true,
  multipartUploadThreshold: 5 * 1024 * 1024, // 5 MB
  multipartUploadSize: 5 * 1024 * 1024, // 5 MB per part
});

// Add debugging to multer configuration
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: Bucket,
    acl: "public-read",
    key: function (req, file, cb) {
      console.log("Processing file:", file.originalname);
      const fileExtension = file.originalname.split(".").pop();
      const newFileName = `source/${uuidv4()}.${fileExtension}`;
      console.log("Generated key:", newFileName);
      cb(null, newFileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
}).single("file"); // Explicitly configure for single file upload

// Wrap multer in a promise with timeout handling
const uploadWithTimeout = (req, res) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Upload timeout"));
    }, 30000); // 30 second timeout

    upload(req, res, (err) => {
      clearTimeout(timeout);
      if (err) {
        console.error("Upload error:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Modified download function with better error handling
const downloadFileAsBuffer = async (fileKeys) => {
  const fileKey = `${fileKeys.baseDir}/${fileKeys.fileName}.${fileKeys.fileExtension}`;
  console.log("Downloading:", fileKey);

  try {
    const data = await s3
      .getObject({
        Bucket: fileKeys.bucketName,
        Key: fileKey,
      })
      .promise();
    return data.Body;
  } catch (error) {
    console.error("Download error:", {
      error: error.message,
      key: fileKey,
      code: error.code,
    });
    throw error;
  }
};

// Modified upload function with streaming
const uploadFileFromBuffer = async (buffer, fileKey, mimeType) => {
  console.log("Starting upload:", fileKey);

  try {
    const upload = s3.upload({
      Bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
      ACL: "public-read",
    });

    // Add upload progress monitoring
    upload.on("httpUploadProgress", (progress) => {
      console.log("Upload progress:", {
        key: fileKey,
        loaded: progress.loaded,
        total: progress.total,
        percent: Math.round((progress.loaded / progress.total) * 100),
      });
    });

    const data = await upload.promise();
    console.log("Upload complete:", fileKey);
    return data.Location;
  } catch (error) {
    console.error("Upload error:", {
      error: error.message,
      key: fileKey,
      code: error.code,
    });
    throw error;
  }
};

// Export the wrapped upload function instead
module.exports = {
  upload: uploadWithTimeout,
  downloadFileAsBuffer,
  uploadFileFromBuffer,
  generateFileKey,
  extractKeysFromURL,
};
