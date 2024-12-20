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
          AccountBasedExpenseLineDetail: {
            type: "object",
            properties: {
              AccountRef: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["value"],
              },
              TaxCodeRef: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["value"],
              },
              ProjectRef: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["value"],
              },
              BillableStatus: { type: "string" },
            },
            required: ["AccountRef"],
          },
        },
        required: ["DetailType", "Amount", "AccountBasedExpenseLineDetail"],
      },
    },
    PaymentType: { type: "string" },
    EntityRef: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "string" },
      },
      required: ["value"],
    },
    AccountRef: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "string" },
      },
      required: ["value"],
    },
    TxnDate: { type: "string" },
    TotalAmount: { type: "number" },
  },
  required: ["Line", "PaymentType", "AccountRef"],
};
