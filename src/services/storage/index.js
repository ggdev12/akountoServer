const multer = require("multer");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");
const uuidv4 = require("uuid").v4;

const Bucket = "akountofiles";

// Basic AWS configuration without any agent or HTTP options
AWS.config = new AWS.Config({
  accessKeyId: "WN72022TEDXURTSOTLPJ",
  secretAccessKey: "XNpSWyTXp018YREiXiaZ9T2qJGN5SsZEyBR7vvYg",
  endpoint: "https://del1.vultrobjects.com",
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

// Simple S3 instance
const s3 = new AWS.S3();

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
  }),
});

const downloadFileAsBuffer = async (fileKeys) => {
  const fileKey = `${fileKeys.baseDir}/${fileKeys.fileName}.${fileKeys.fileExtension}`;
  try {
    const data = await s3
      .getObject({
        Bucket: fileKeys.bucketName,
        Key: fileKey,
      })
      .promise();
    return data.Body;
  } catch (error) {
    console.error("Error downloading file:", error.message, fileKey);
    throw error;
  }
};

const uploadFileFromBuffer = async (buffer, fileKey, mimeType) => {
  try {
    const data = await s3
      .upload({
        Bucket: Bucket,
        Key: fileKey,
        Body: buffer,
        ContentType: mimeType,
        ACL: "public-read",
      })
      .promise();
    return data.Location;
  } catch (error) {
    console.error("Error uploading file:", error.message);
    throw error;
  }
};

// Keep other functions as is
const generateFileKey = ({ bucketName, baseDir, fileName, fileExtension }) => {
  const uniqueId = uuidv4();
  return `${bucketName}/${baseDir}/${fileName}-${uniqueId}.${fileExtension}`;
};

const extractKeysFromURL = (fileURL) => {
  const url = new URL(fileURL);
  const pathSegments = url.pathname.split("/");
  const bucketName = pathSegments[1];
  const baseDir = pathSegments[2];
  const fileNameWithExtension = pathSegments[pathSegments.length - 1];
  const fileName = fileNameWithExtension.split(".")[0].replace(/%20/g, "-");
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
