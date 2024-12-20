const samples = require("./sample");
const models = require("./../../../models");

const { Expense, Vendor, Account, Currency, ExpenseLine, TaxCode } = models;

async function createExpenseFromSample(sample) {
  // Find or create Vendor
  const [vendor] = await Vendor.findOrCreate({
    where: { externalId: sample.EntityRef.value },
    defaults: { name: sample.EntityRef.name, IntegrationId: 1, CompanyId: 1 },
  });

  // Find or create Account
  const [paymentAccount] = await Account.findOrCreate({
    where: { externalId: sample.AccountRef.value },
    defaults: { name: sample.AccountRef.name, IntegrationId: 1, CompanyId: 1 },
  });

  // Find or create Currency
  const [currency] = await Currency.findOrCreate({
    where: { code: sample.CurrencyRef.value },
    defaults: { name: sample.CurrencyRef.name, IntegrationId: 1, CompanyId: 1 },
  });

  // Create Expense
  const expense = await Expense.create({
    externalId: sample.Id,
    paymentType: sample.PaymentType,
    isCredit: sample.Credit,
    totalAmount: sample.TotalAmt,
    transactionDate: sample.TxnDate,
    VendorId: vendor.id,
    paymentAccountId: paymentAccount.id,
    CurrencyId: currency.id,
    IntegrationId: 1,
    CompanyId: 1,
  });

  // Create ExpenseLines
  for (const line of sample.Line) {
    const [expenseAccount] = await Account.findOrCreate({
      where: {
        externalId: line.AccountBasedExpenseLineDetail.AccountRef.value,
      },
      defaults: {
        name: line.AccountBasedExpenseLineDetail.AccountRef.name,
        IntegrationId: 1,
        CompanyId: 1,
      },
    });

    const [taxCode] = await TaxCode.findOrCreate({
      where: { code: line.AccountBasedExpenseLineDetail.TaxCodeRef.value },
      defaults: {
        code: line.AccountBasedExpenseLineDetail.TaxCodeRef.value,
        IntegrationId: 1,
        CompanyId: 1,
      }, // Assuming name is not necessary or is the same as code
    });

    await ExpenseLine.create({
      ExpenseId: expense.id,
      amount: line.Amount,
      detailType: line.DetailType,
      billableStatus: line.AccountBasedExpenseLineDetail.BillableStatus,
      expenseAccountId: expenseAccount.id,
      TaxCodeId: taxCode.id,
      IntegrationId: 1,
      CompanyId: 1,
    });
  }
}

createExpenseFromSample(samples.Expense);
