const dotenv = require("dotenv");
// Load environment variables
dotenv.config();

const { source, processed } = require("./doc.json");
const DocumentProcessor = require("./../worker/index");

const processor = new DocumentProcessor(source);
processor.processedImages = processed.processedImages;

describe("Document Processor - Extract", () => {
  test("should extract raw json from the document", async () => {
    await processor.extract();
    expect(processor.documentRawJSON).toBeDefined();
    expect(processor.documentRawJSON).toContain("```json");
  }, 30000); // Timeout of 30 seconds
});
