const dotenv = require("dotenv");
// Load environment variables
dotenv.config();

const document = require("./doc.json");
const DocumentProcessor = require("./../worker/index");

const processor = new DocumentProcessor(document.source);

describe("Document Processor - Convert", () => {
  test("should convert the document to images", async () => {
    await processor.convert();
    expect(Array.isArray(processor.documentImages)).toBeTruthy();
    expect(processor.documentImages.length).toBeGreaterThan(0);
    processor.documentImages.forEach((imageUrl) => {
      expect(typeof imageUrl).toBe("string");
      expect(imageUrl).toMatch(/^https?:\/\/.+/); // Check if imageUrl is a valid URL
    });
  });
});
