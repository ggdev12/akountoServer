const multer = require("multer");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");
const uuidv4 = require("uuid").v4;

const Bucket = "akountofiles";

AWS.config.update({
  accessKeyId: "WN72022TEDXURTSOTLPJ",
  secretAccessKey: "XNpSWyTXp018YREiXiaZ9T2qJGN5SsZEyBR7vvYg",
  endpoint: new AWS.Endpoint("https://del1.vultrobjects.com"),
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  httpOptions: {
    timeout: 300000, // 5 minutes
    connectTimeout: 60000, // 1 minute for connection establishment
    agent: new AWS.HttpClient(), // Force new connection agent
  },
  maxRetries: 3,
  retryDelayOptions: { base: 1000 },
});

const s3 = new AWS.S3();

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "akountofiles",
    acl: "public-read",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const originalName = file.originalname;
      const fileExtension = originalName.split(".").pop();
      const newFileName = `source/${uuidv4()}.${fileExtension}`;
      cb(null, newFileName);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

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

const uploadFileFromBuffer = async (buffer, fileKey, mimeType) => {
  console.log(fileKey, mimeType);
  const params = {
    Bucket: Bucket,
    Key: fileKey,
    Body: buffer,
    ContentType: mimeType,
    ACL: "public-read",
  };

  try {
    const data = await s3.upload(params).promise();

    return data.Location;
  } catch (error) {
    console.error("Error uploading file:", error.message);
    throw error;
  }
};

module.exports = {
  upload,
  downloadFileAsBuffer,
  uploadFileFromBuffer,
  generateFileKey,
  extractKeysFromURL,
};
