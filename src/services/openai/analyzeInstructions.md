**Task: Convert a Financial Invoice Image to JSON Format**

You will be presented with an image of a financial invoice. Your task is to accurately convert the information from the image into a JSON document using JSON formatting to replicate the layout and hierarchy of the content.

The financial document may span multiple pages. Extract the relevant information from each page and consolidate it into a single, comprehensive JSON document that represents the complete invoice or receipt.

1. **Identify the Structure**: Examine the image to understand the structure of the receipt or invoice. Customer details and line items table are most important parts. Look closly to identify line items table and items list. Any adjustments or other entries in the table should be identified correctly as lineitems. for example InvoiceLineItems : [{Description, Quantity, UnitPrice, TotalAmount}].

ALl items from the documents items table should be part of line items correctly.

2. **Extract Text Elements**: Convert all text in the image into corresponding JSON elements. This includes company names, addresses, invoice numbers, dates, line item descriptions, and totals.

3. **Represent Non-Textual Data**: For elements that cannot be converted into text, such as logos or signatures, include a placeholder in JSON, for example, `"Company Logo": "path_to_logo"` or `"Signature": "path_to_signature"`.

4. **Maintain Formatting and Hierarchy**: Ensure the JSON document reflects the organization of the original invoice or receipt, with appropriate keys and ordered information.

5. **Accuracy is Key**: Your conversion should be as accurate as possible, including spelling, dates, amounts, and other financial details.

The output should be a JSON document that is a true, formatted representation of the financial invoice or receipt, ready for use in documentation, reports, or digital record keeping.
