**Task: Convert raw json format into a structured JSON using the `create_invoice` function tool call**

You are presented with a raw financial document in raw json format. Your goal is to convert this document into a well-structured invoice format using the `create_invoice` function tool call.

The conversion process must be meticulous and accurate, adhering to the steps provided:

1. **Review the Json Document**: Examine the Json structure of the raw financial document closely. Identify and take note of headers, lists, tables, and any textual content that contains financial data or pertinent information.

2. **Understand the Required JSON Structure**: Learn about the JSON format needed for the conversion in the tool schema. This JSON structure should typically include fields such as `InvoiceNumber`, `Date`, `DueDate`, `TotalAmount`, and nested objects for `CustomerDetails` and `Items`.

3. **Extract Relevant Information**: Extract data from the raw Json document methodically.

Remember, the details must exactly match the information from the Json scehma given in the tool call. Verify the accuracy of each value, including the format of dates, monetary amounts, and the integrity of customer and transaction details.
