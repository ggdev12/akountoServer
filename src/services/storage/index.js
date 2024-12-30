const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const uuidv4 = require("uuid").v4;
const https = require("https");

const Bucket = "akountofiles";

// Configure AWS with HTTP/2 support and appropriate timeouts
AWS.config = new AWS.Config({
  accessKeyId: "WN72022TEDXURTSOTLPJ",
  secretAccessKey: "XNpSWyTXp018YREiXiaZ9T2qJGN5SsZEyBR7vvYg",
  endpoint: "https://del1.vultrobjects.com",
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  httpOptions: {
    timeout: 300000, // 5 minutes
    connectTimeout: 60000, // 1 minute
    agent: new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 3000,
      maxSockets: 25,
      rejectUnauthorized: true,
    }),
  },
  maxRetries: 3,
  retryDelayOptions: { base: 300 },
});

const s3 = new AWS.S3();

// Add retry logic for uploads
const uploadWithRetry = async (params, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await s3.upload(params).promise();
    } catch (error) {
      console.error(`Upload attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: Bucket,
    acl: "public-read",
    key: function (req, file, cb) {
      const fileExtension = file.originalname.split(".").pop();
      const newFileName = `source/${uuidv4()}.${fileExtension}`;
      cb(null, newFileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Modify uploadFileFromBuffer to use retry logic
const uploadFileFromBuffer = async (buffer, fileKey, mimeType) => {
  console.log(`Starting upload for ${fileKey}`);
  const params = {
    Bucket,
    Key: fileKey,
    Body: buffer,
    ContentType: mimeType,
    ACL: "public-read",
  };

  try {
    const data = await uploadWithRetry(params);
    console.log("Upload completed successfully");
    return data.Location;
  } catch (error) {
    console.error("Upload failed after retries:", error);
    throw error;
  }
};

const downloadFileAsBuffer = async (fileKeys) => {
  const fileKey =
    fileKeys.baseDir + "/" + fileKeys.fileName + "." + fileKeys.fileExtension;
  const params = {
    Bucket: fileKeys.bucketName,
    Key: fileKey,
    Expires: 60 * 60, // URL expiration in seconds
  };

  console.log("Downloading file from", fileKey);

  try {
    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (error) {
    if (error.code === "TimeoutError") {
      console.error("Connection timed out while downloading file:", fileKey);
      throw new Error(`Connection timeout while downloading file: ${fileKey}`);
    }
    console.error("Error downloading file:", error.message, fileKey);
    throw error;
  }
};

const generateFileKey = ({ bucketName, baseDir, fileName, fileExtension }) => {
  const uniqueId = uuidv4();
  return `${bucketName}/${baseDir}/${fileName}-${uniqueId}.${fileExtension}`;
};

const extractKeysFromURL = (fileURL) => {
  const url = new URL(fileURL);
  const bucketName = url.pathname.split("/")[1];
  const pathSegments = url.pathname.split("/");
  const baseDir = pathSegments[2];
  const fileNameWithExtension = pathSegments.slice(-1)[0];
  let fileName = fileNameWithExtension.split(".")[0];
  console.log("fileName", fileName);
  fileName = fileName.replace(/%20/g, "-");
  const fileExtension = fileNameWithExtension.split(".").pop();
  console.log(
    `Extracted details - Bucket: ${bucketName}, Base Dir: ${baseDir}, Filename: ${fileName}, Extension: ${fileExtension}`,
  );
  return { bucketName, baseDir, fileName, fileExtension };
};

module.exports = {
  upload,
  downloadFileAsBuffer,
  uploadFileFromBuffer,
  generateFileKey,
  extractKeysFromURL,
};
