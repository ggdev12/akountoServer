const dotenv = require("dotenv");
// Load environment variables
dotenv.config();

const { source, processed } = require("./doc.json");
const DocumentProcessor = require("./../worker/index");

const processor = new DocumentProcessor(source);
processor.processedImages = processed.processedImages;
let processed_data = JSON.parse(processed.processed_data);

processor.documentRawJSON = processed_data.raw_json;

describe("Document Processor - Transform", () => {
  test("should transform raw json into a local sysem comptable valid json", async () => {
    await processor.transform();
    expect(processor.documentProcessedJSON).toBeDefined();
    expect(processor.transformedInvoice).toBeDefined();
  }, 30000); // Timeout of 30 seconds
});
