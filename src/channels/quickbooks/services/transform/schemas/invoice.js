module.exports = {
  type: "object",
  properties: {
    Line: {
      type: "array",
      items: {
        type: "object",
        properties: {
          DetailType: { type: "string" },
          Amount: { type: "number" },
          SalesItemLineDetail: {
            type: "object",
            properties: {
              ItemRef: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["name", "value"],
              },
              TaxCodeRef: {
                type: "object",
                properties: { value: { type: "string" } },
                required: ["value"],
              },
              Qty: { type: "number" },
              UnitPrice: { type: "number" },
            },
            required: ["ItemRef"],
          },
        },
        required: ["DetailType", "Amount", "SalesItemLineDetail"],
      },
    },
    CustomerRef: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "string" },
      },
      required: ["value"],
    },
    TxnDate: { type: "string" },
    TotalAmt: { type: "number" },
    DueDate: { type: "string" },
    DocNumber: { type: "string" },
    BillEmail: { type: "object", properties: { Address: { type: "string" } } },
    ShipAddr: {
      type: "object",
      properties: {
        City: { type: "string" },
        Line1: { type: "string" },
        PostalCode: { type: "string" },
        Lat: { type: "string" },
        Long: { type: "string" },
        CountrySubDivisionCode: { type: "string" },
        Id: { type: "string" },
      },
    },
    BillAddr: {
      type: "object",
      properties: {
        Line1: { type: "string" },
        Line2: { type: "string" },
        Line3: { type: "string" },
        Line4: { type: "string" },
        Long: { type: "string" },
        Lat: { type: "string" },
        Id: { type: "string" },
      },
    },
    SalesTermRef: { type: "object", properties: { value: { type: "string" } } },
    ApplyTaxAfterDiscount: { type: "boolean" },
    CustomerMemo: { type: "object", properties: { value: { type: "string" } } },
    ProjectRef: { type: "object", properties: { value: { type: "string" } } },
    Deposit: { type: "number" },
    Balance: { type: "number" },
    TxnTaxDetail: {
      type: "object",
      properties: {
        TxnTaxCodeRef: {
          type: "object",
          properties: { value: { type: "string" } },
        },
        TotalTax: { type: "number" },
        TaxLine: {
          type: "array",
          items: {
            type: "object",
            properties: {
              DetailType: { type: "string" },
              Amount: { type: "number" },
              TaxLineDetail: {
                type: "object",
                properties: {
                  NetAmountTaxable: { type: "number" },
                  TaxPercent: { type: "number" },
                  TaxRateRef: {
                    type: "object",
                    properties: { value: { type: "string" } },
                  },
                  PercentBased: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    SyncToken: { type: "string" },
    LinkedTxn: {
      type: "array",
      items: {
        type: "object",
        properties: { TxnId: { type: "string" }, TxnType: { type: "string" } },
      },
    },
    EmailStatus: { type: "string" },
    MetaData: {
      type: "object",
      properties: {
        CreateTime: { type: "string" },
        LastUpdatedTime: { type: "string" },
      },
    },
    CustomField: {
      type: "array",
      items: {
        type: "object",
        properties: {
          DefinitionId: { type: "string" },
          StringValue: { type: "string" },
          Type: { type: "string" },
          Name: { type: "string" },
        },
      },
    },
  },
  required: ["Line", "CustomerRef"],
};
