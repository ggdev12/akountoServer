const sourceInvoice = {
  InvoiceNumber: "4948636466",
  Date: "31 Mar 2024",
  DueDate: "",
  Currency: "USD",
  PaymentTerms: "Net 30",
  Subtotal: 0.12,
  DiscountTotal: 0,
  SalesTaxRate: 0,
  SalesTaxAmount: 0,
  TotalAmount: 0.12,
  AmountPaid: 0,
  BalanceDue: 0.12,
  VendorDetails: {
    CompanyName: "Google Ireland Limited",
    Address: "Gordon House, Barrow Street, Dublin 4, Ireland",
    ContactEmail: "collections@google.com",
    BankDetails: {
      AccountHolderName: "Google Ireland Limited",
      BankName: "Citibank, N.A. London Branch",
      AccountNumber: "11074911",
      RoutingNumber: "CITIGB2L",
    },
  },
  CustomerDetails: {
    CompanyName: "KOUNTO DIGITAL - FZE",
    BillingAddress:
      "DSO-DP-A5D-FZD-1020 Dubai Digital Park Office A5, Dubai Silicon Oasis, Dubai, United Arab Emirates",
  },
  Items: [
    {
      Description: "AR-CB-GS-08-feb-2024",
      Quantity: 14,
      UnitPrice: 0.4242857142857143,
      Discount: 0,
      TotalAmount: 5.94,
    },
    {
      Description: "Credit for invalid activity",
      Quantity: 1,
      UnitPrice: -5.82,
      Discount: 0,
      TotalAmount: -5.82,
    },
  ],
  Notes:
    "PO# or invoice numbers associated with the invalid activity might have changed if there was a rebill. For questions about this invoice please email collections@google.com",
  CreatedBy: "",
};

const QuickBooks = require("../src/channels/quickbooks/Class");

const qb = new QuickBooks();

describe(" - Transform AI data into a quickbooks Object and validate it against minimum required schema to find missing feilds etc ", () => {
  test(" transform source invoice correctly", async () => {
    const invoice = await qb.invoice.transform(sourceInvoice);
    expect(invoice).toBeTruthy();
  });

  test(" validate transformed invoice correctly", async () => {
    const invoice = await qb.invoice.transform(sourceInvoice);
    const isValid = await qb.invoice.validate(invoice);

    expect(isValid).toBeTruthy();
  });
});
