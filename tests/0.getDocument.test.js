const dotenv = require("dotenv");
// Load environment variables
dotenv.config();

const document = require("./doc.json");
const DocumentProcessor = require("./../worker/index");

const processor = new DocumentProcessor(document.source);

describe("Document Processor - Get Document", () => {
  test("should get document object from the database", async () => {
    await processor.getDocument();
    expect(processor.documentObject).toBeDefined();
    expect(processor.documentObject.id).toBe(document.source.id);
  });
});
