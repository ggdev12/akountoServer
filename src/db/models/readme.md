This financial management system streamlines the process of handling and synchronizing sales invoices and purchase receipts between businesses and their accounting systems, such as QuickBooks, Xero, and Zoho. Designed to serve users across different markets, particularly in India and the USA, it offers a sophisticated platform where users can upload financial documents in PDF format. The system automatically extracts data from these documents using OCR technology, categorizes them based on their processing status (e.g., extraction, ready, missing data, processed), and matches them with existing vendor and customer records in the database. For each document, it meticulously tracks its journey from upload to successful synchronization with the chosen accounting system, ensuring that all financial transactions are accurately reflected in the user's accounting software. By automating the tedious process of data entry and synchronization, this system saves businesses considerable time and effort, while significantly reducing the risk of human error, making financial management more efficient and reliable.

# Models

## User

- id: UUID
- email: String
- password: String (hashed)
- role: Enum ("User", "Admin")

## Company

- id: UUID
- user_id: UUID (FK to User)
- name: String
- country: String
- integrations_id: UUID (FK to Integrations)

## Integrations

- id: UUID
- company_id: UUID (FK to Company)
- service_type: Enum ("QuickBooks", "Xero", "Zoho", etc.)
- credentials: EncryptedString

## Customer

- id: UUID
- company_id: UUID (FK to Company)
- name: String
- email: String
- billing_address: JSON
- shipping_address: JSON
- phone: String
- external_id: String (nullable)
- is_synced: Boolean (default: False) // Indicates if synced with external system

## Vendor

- id: UUID
- company_id: UUID (FK to Company)
- name: String
- email: String
- address: JSON
- phone: String
- external_id: String (nullable)
- is_synced: Boolean (default: False) // Indicates if synced with external system

## Document

- id: UUID
- company_id: UUID (FK to Company)
- customer_id: UUID (FK to Customer, nullable)
- vendor_id: UUID (FK to Vendor, nullable)
- type: Enum ("Invoice", "Receipt")
- status: Enum ("Inbox", "Extraction", "Ready", "MissingData", "Processed", "Failed", "Processing")
- file_path: String
- processed_data: JSON
- error_message: String (nullable)

## Invoice

- id: UUID
- document_id: UUID (FK to Document)
- invoice_number: String
- date: Date
- due_date: Date
- currency: String
- payment_terms: String
- subtotal: Decimal
- discount_total: Decimal
- total_amount: Decimal
- amount_paid: Decimal
- balance_due: Decimal
- vendor_details: JSON
- customer_details: JSON
- notes: String
- created_by: String
- sales_term_ref: String
- deposit: Decimal
- bill_email: String
- ship_address: JSON
- bill_address: JSON
- custom_fields: JSON
- linked_txns: JSON

## InvoiceLineItem

- id: UUID
- invoice_id: UUID (FK to Invoice)
- description: String
- quantity: Integer
- unit_price: Decimal
- discount: Decimal
- total_amount: Decimal
- item_ref: String
- tax_code_ref: String

## InvoiceTax

- id: UUID
- invoice_id: UUID (FK to Invoice)
- tax_type: String (e.g., "CGST", "SGST", "IGST", "SalesTax")
- tax_rate: Decimal
- tax_amount: Decimal

## Purchase

- id: UUID
- document_id: UUID (FK to Document)
- txn_date: Date
- total_amount: Decimal
- payment_type: String
- account_ref: String
- custom_fields: JSON

## PurchaseLineItem

- id: UUID
- purchase_id: UUID (FK to Purchase)
- amount: Decimal
- project_ref: String
- account_ref: String
- billable_status: String
- tax_code_ref: String

## SyncLog (To track synchronization attempts)

- id: UUID
- company_id: UUID (FK to Company)
- integration_id: UUID (FK to Integration)
- entity_type: Enum ("Document", "Customer", "Vendor")
- entity_id: UUID (FK to Document, Customer or Vendor)
- sync_date: DateTime
- error_message: String (nullable)

## EntityMapping

- id: UUID
- company_id: UUID (FK to Company)
- integration_id: UUID (FK to Integration)
- entity_type: Enum ("Document", "Customer", "Vendor", "Invoice", "Purchase")
- internal_id: UUID (FK to respective entity)
- external_id: String
- sync_status: Enum ("ToSync", "Synced", "Failed")
