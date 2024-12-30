const multer = require("multer");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");
const uuidv4 = require("uuid").v4;
const https = require("https");

const Bucket = "akountofiles";

// Create a custom HTTPS agent with IPv4 preference
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  timeout: 60000,
  family: 4, // Force IPv4
});

// AWS Configuration
AWS.config = new AWS.Config({
  accessKeyId: "WN72022TEDXURTSOTLPJ",
  secretAccessKey: "XNpSWyTXp018YREiXiaZ9T2qJGN5SsZEyBR7vvYg",
  endpoint: "https://del1.vultrobjects.com",
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  httpOptions: {
    timeout: 60000,
    connectTimeout: 30000,
    agent: agent,
  },
});

const s3 = new AWS.S3();

// Create multer instance with simplified configuration
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: Bucket,
    acl: "public-read",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const fileExtension = file.originalname.split(".").pop();
      const newFileName = `source/${uuidv4()}.${fileExtension}`;
      console.log("Generating file key:", newFileName);
      cb(null, newFileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});
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
  fileName = fileName.replace(/%20/g, "-");
  const fileExtension = fileNameWithExtension.split(".").pop();
  return { bucketName, baseDir, fileName, fileExtension };
};

module.exports = {
  upload,
  downloadFileAsBuffer,
  uploadFileFromBuffer,
  generateFileKey,
  extractKeysFromURL,
};
