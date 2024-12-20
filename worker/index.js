const models = require("./../src/db/models");
const {
  downloadFileAsBuffer,
  uploadFileFromBuffer,
  generateFileKey,
  extractKeysFromURL,
} = require("./../src/services/storage");
const AIService = require("./../src/services/openai");
const Quickbooks = require("./../src/channels/quickbooks/Class");

const { convertPDFtoImages } = require("./../src/services/fileops");

const dotenv = require("dotenv");
// Load environment variables
dotenv.config();
class DocumentProcessor {
  constructor(document) {
    this.aiService = new AIService();
    this.quickbooks = new Quickbooks();

    this.document = document; // id, file_path
    this.documentObject = {};

    this.documentImages = []; // array of images to be processed by OCR AI;

    this.documentRawJSON = {};
    this.documentProcessedJSON = {};

    this.transformedInvoice = {};
    this.isValidInvoice = false;
  }

  async process() {
    await this.getDocument();
    await this.convert();
    await this.extract();
    await this.transform();
    await this.validate();
    await this.sync();
  }

  async getDocument() {
    this.documentObject = await models.Document.findByPk(this.document.id);
  }

  async convert() {
    console.log("Downloading file from URL:", this.document.file_path);

    const fileKeys = extractKeysFromURL(this.document.file_path);
    let file = await downloadFileAsBuffer(fileKeys);

    const isPDF = fileKeys.fileExtension === "pdf";
    let processedFileKey = `processed/${fileKeys.fileName}${isPDF ? "" : fileKeys.fileExtension}`;

    if (isPDF) {
      console.log(" - Converting PDF to images");

      const base64Images = await convertPDFtoImages(file);

      this.documentImages = await Promise.all(
        base64Images.map(async (image, index) => {
          const pageFileKey = `processed/${fileKeys.fileName}_page_${index + 1}.jpeg`;
          return uploadFileFromBuffer(
            Buffer.from(image, "base64"),
            pageFileKey,
            "image/jpeg",
          );
        }),
      );

      console.log(" - Converted PDF to images");
    } else {
      this.documentImages.push(
        await uploadFileFromBuffer(file, processedFileKey, "image/jpeg"),
      );
    }
    console.log("Processed files uploaded ---->>>>", this.documentImages);
  }

  async extract() {
    this.documentRawJSON = await this.aiService.analyzeImages(
      this.documentImages,
    );
  }

  async transform() {
    this.documentProcessedJSON = await this.aiService.extractJson(
      this.documentRawJSON,
    );
    this.transformedInvoice = this.quickbooks.invoice.transform(
      this.documentProcessedJSON,
    );
  }

  async validate() {
    this.isValidInvoice = this.quickbooks.invoice.validate(
      this.transformedInvoice,
    );
  }

  async save() {
    this.documentObject.save();
  }

  async sync() {
    // Sync the transformed data to target system
    console.log(`Syncing data to ${this.targetSystem}...`);
    // Placeholder for sync logic
  }
}

module.exports = DocumentProcessor;
