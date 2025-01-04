const {
  type,
  properties,
} = require("../../channels/quickbooks/services/transform/schemas/invoice");

module.exports.invoiceJsonSchema = {
  InvoiceNumber: { type: "string" },
  Date: { type: "date", description: "The date in 'YYYY-MM-DD' format" },
  DueDate: { type: "date", description: "The date in 'YYYY-MM-DD' format" },
  Currency: {
    type: "string",
    description: "The currency should be in SO 4217 format",
  },
  PaymentTerms: { type: "string" },
  Subtotal: { type: "number" },
  DiscountTotal: { type: "number" },
  SalesTaxRate: { type: "number" },
  SalesTaxAmount: { type: "number" },
  TotalAmount: { type: "number" },
  AmountPaid: { type: "number" },
  BalanceDue: { type: "number" },
  VendorDetails: {
    type: "object",
    properties: {
      CompanyName: { type: "string" },
      Address: {
        type: "object",
        properties: {
          Line1: { type: "string" },
          Line2: { type: "string" },
          City: { type: "string" },
          State: { type: "string" },
          ZipCode: { type: "string" },
        },
      },
      ContactEmail: { type: "string" },
      BankDetails: {
        type: "object",
        properties: {
          AccountHolderName: { type: "string" },
          BankName: { type: "string" },
          AccountNumber: { type: "string" },
          RoutingNumber: { type: "string" },
        },
      },
    },
  },
  CustomerDetails: {
    type: "object",
    properties: {
      CompanyName: { type: "string" },
      BillingAddress: {
        type: "object",
        properties: {
          Line1: { type: "string" },
          Line2: { type: "string" },
          City: { type: "string" },
          State: { type: "string" },
          ZipCode: { type: "string" },
        },
      },
    },
  },
  Items: {
    type: "array",
    items: {
      type: "object",
      properties: {
        Description: { type: "string" },
        Quantity: { type: "integer" },
        UnitPrice: { type: "number" },
        Discount: { type: "number" },
        TotalAmount: { type: "number" },
      },
    },
  },
  Notes: { type: "string" },
  CreatedBy: { type: "string" },
};

module.exports.purchaseJsonSchema = {
  TransactionDate: {
    type: "date",
    description: "The date in 'YYYY-MM-DD' format",
  },
  TotalAmount: { type: "number" },
  PaymentType: { type: "string", enum: ["Check", "CreditCard", "Cash"] },
  AccountRef: {
    type: "object",
    properties: {
      name: { type: "string" },
      account_number: { type: "string" },
    },
  },
  PurchaseLines: {
    type: "array",
    items: {
      type: "object",
      properties: {
        Amount: { type: "integer" },
        ProjectRef: { type: "integer" },
        AccountRef: { type: "integer" },
        BillStatus: {
          type: "string",
          enum: ["Billable", "NotBillable", "HasBeenBilled"],
        },
        TaxCodeRef: { type: "string" },
      },
    },
  },
  VendorDetails: {
    type: "object",
    properties: {
      Name: { type: "string" },
      Email: { type: "string" },
      Address: {
        type: "object",
        properties: {
          Line1: { type: "string" },
          Line2: { type: "string" },
          City: { type: "string" },
          State: { type: "string" },
          ZipCode: { type: "string" },
        },
      },
      PhoneNumber: { type: "string" },
    },
  },
};
