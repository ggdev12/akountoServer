const Ajv = require("ajv");
const ajv = new Ajv();

class QuickBooks {
  constructor() {}

  invoice = {
    transform(sourceInvoice) {
      // Validate the source invoice format first
      if (
        !sourceInvoice ||
        !sourceInvoice.Items ||
        !sourceInvoice.CustomerDetails ||
        !sourceInvoice.VendorDetails
      ) {
        console.error("Missing required fields in source invoice.");
        return false;
      }
      sourceInvoice.Items.map((item) => {
        console.log("Amount->", parseFloat(item.TotalAmount));
      });

      const transformedInvoice = {
        Line: sourceInvoice.Items.map((item) => {
          // Ensure TotalAmount is treated as a number
          const amount = Number(item.TotalAmount);
          return {
            DetailType: "SalesItemLineDetail",
            Amount: amount,
            SalesItemLineDetail: {
              ItemRef: {
                name: item.Description,
                value: "1", // Assuming a default value for ItemRef due to lack of specific mapping
              },
            },
          };
        }),
        CustomerRef: {
          value: sourceInvoice.CustomerDetails.CompanyName, // Using CompanyName as a value for CustomerRef
        },
        // Additional fields required by QuickBooks schema but not present in the source invoice
        CurrencyRef: {
          value: sourceInvoice.Currency, // Assuming Currency is directly usable
        },
        BillEmail: {
          Address: sourceInvoice.VendorDetails.ContactEmail, // Using Vendor contact email for BillEmail
        },
        DueDate: sourceInvoice.DueDate,
        TxnDate: sourceInvoice.Date,
        TotalAmt: parseFloat(sourceInvoice.TotalAmount), // Ensure TotalAmount is treated as a number
      };

      return transformedInvoice;
    },

    validate(input) {
      const validate = ajv.compile(
        require("./services/transform/schemas/invoice"),
      );
      const isValid = validate(input);

      console.log("isValidInvoice", isValid);

      if (!isValid) {
        console.error("Validation failed:", validate.errors);
        return false;
      }
      return true;
    },
  };

  receipt = {
    transform(sourceReceipt, vendorId) {
      // Validate the source receipt format first
      if (
        !sourceReceipt ||
        !sourceReceipt.PurchaseLines ||
        !sourceReceipt.VendorDetails ||
        !sourceReceipt.PaymentType
      ) {
        console.error("Missing required fields in source receipt.");
        return false;
      }

      const transformedReceipt = {
        Line: sourceReceipt.PurchaseLines.map((item) => {
          return {
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: item.Amount,

            AccountBasedExpenseLineDetail: {
              AccountRef: {
                value: "92",
              },
              // TaxCodeRef: {
              //   value: "NON",
              // },
              // ProjectRef: {
              //   value: item.ProjectRef.value,
              // },
              BillableStatus: "NotBillable",
            },
          };
        }),
        PaymentType: sourceReceipt.PaymentType,
        AccountRef: {
          value: "93",
        },
        TxnDate: sourceReceipt.TransactionDate,
        TotalAmt: sourceReceipt.TotalAmount,
        EntityRef: {
          value: vendorId,
        },
      };

      return transformedReceipt;
    },

    validate(input) {
      const validate = ajv.compile(
        require("./services/transform/schemas/receipt"),
      );
      const isValid = validate(input);
      if (!isValid) {
        console.error("Validation failed:", validate.errors);
        return false;
      }
      return true;
    },
  };
}

module.exports = QuickBooks;
