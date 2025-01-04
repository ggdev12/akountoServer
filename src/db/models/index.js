const { Sequelize, DataTypes } = require("sequelize");
const config = require("./../../../config/config");

const sequelize = new Sequelize(config.development);

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM("User", "Admin"),
    allowNull: false,
    defaultValue: "Admin",
  },
});

const ChatHistory = sequelize.define("ChatHistory", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  prompt: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  result: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Company = sequelize.define("Company", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  legalName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyAddress: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  customerCommunicationAddress: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  legalAddress: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  customerCommunicationEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fiscalYearStartMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  supportedLanguages: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  subscriptionStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  offeringSku: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  industryType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Integration = sequelize.define("Integration", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  service_type: {
    type: DataTypes.ENUM("QuickBooks", "Xero", "Zoho", "Quickbooks"),
    allowNull: false,
    defaultValue: "QuickBooks",
  },
  credentials: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("Connected", "Disconnected"),
    allowNull: true,
    defaultValue: "Disconnected",
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Customer = sequelize.define("Customer", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  billing_address: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  shipping_address: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Vendor = sequelize.define("Vendor", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Document = sequelize.define("Document", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM("Invoice", "Receipt"),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      "Inbox",
      "Extraction",
      "Ready",
      "MissingData",
      "Processed",
      "Failed",
      "Processing",
      "Error",
    ),
    allowNull: false,
    defaultValue: "Inbox",
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  processed_image_file_paths: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  processed_data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Invoice = sequelize.define("Invoice", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoice_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_terms: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subtotal: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  discount_total: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  total_amount: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  amount_paid: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  balance_due: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  vendor_details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  customer_details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  notes: {
    type: DataTypes.STRING,
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sales_term_ref: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deposit: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  bill_email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ship_address: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  bill_address: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  custom_fields: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  linked_txns: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

const InvoiceLineItem = sequelize.define("InvoiceLineItem", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  unit_price: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  discount: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  total_amount: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  item_ref: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tax_code_ref: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const InvoiceTax = sequelize.define("InvoiceTax", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tax_type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tax_rate: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  tax_amount: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
});

const Purchase = sequelize.define("Purchase", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  txn_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  total_amount: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  payment_type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  account_ref: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  custom_fields: {
    type: DataTypes.JSON,
  },
});

const PurchaseLineItem = sequelize.define("PurchaseLineItem", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  amount: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  project_ref: {
    type: DataTypes.STRING,
  },
  account_ref: {
    type: DataTypes.STRING,
  },
  billable_status: {
    type: DataTypes.STRING,
  },
  tax_code_ref: {
    type: DataTypes.STRING,
  },
});

const SyncLog = sequelize.define("SyncLog", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  entity_type: {
    type: DataTypes.ENUM(
      "Document",
      "Customer",
      "Vendor",
      "Invoice",
      "Purchase",
    ),
    allowNull: false,
  },
  sync_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  error_message: {
    type: DataTypes.STRING,
  },
  entityMappingId: {
    type: DataTypes.UUID,
    references: {
      model: "EntityMappings",
      key: "id",
    },
  },
  text_job_description: {
    type: DataTypes.TEXT,
  },
  sync_status: {
    type: DataTypes.ENUM("Queued", "Processing", "Synced", "Failed"),
    allowNull: false,
  },
});

const EntityMapping = sequelize.define("EntityMapping", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  entity_type: {
    type: DataTypes.ENUM(
      "Document",
      "Customer",
      "Vendor",
      "Invoice",
      "Purchase",
    ),
    allowNull: false,
  },
  external_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  local_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
});

const PricingPlan = sequelize.define("PricingPlan", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  billing_cycle: {
    type: DataTypes.ENUM("monthly", "yearly"),
    allowNull: false,
  },
  stripe_price_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  features: {
    type: DataTypes.JSON,
  },
});

const UserPlanMapping = sequelize.define("UserPlanMapping", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  end_date: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.ENUM("active", "cancelled", "expired"),
    allowNull: false,
    defaultValue: "active",
  },
  isFreeTrial: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  trialEnd: {
    type: DataTypes.DATE,
  },
  trialStart: {
    type: DataTypes.DATE,
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
  },
});

const SubscriptionHistory = sequelize.define("SubscriptionHistory", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  action: {
    type: DataTypes.ENUM("subscribe", "unsubscribe", "upgrade", "downgrade", "freeTrial"),
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  details: {
    type: DataTypes.TEXT,
  },
});

// Associations for new models
User.hasMany(UserPlanMapping);
UserPlanMapping.belongsTo(User);

PricingPlan.hasMany(UserPlanMapping);
UserPlanMapping.belongsTo(PricingPlan);

User.hasMany(SubscriptionHistory);
SubscriptionHistory.belongsTo(User);

PricingPlan.hasMany(SubscriptionHistory);
SubscriptionHistory.belongsTo(PricingPlan);

// Associations

User.hasMany(ChatHistory);
ChatHistory.belongsTo(User);

User.hasMany(Company);
Company.belongsTo(User);

Company.hasMany(Integration);
Integration.belongsTo(Company);

Company.hasMany(Customer);
Customer.belongsTo(Company);

Company.hasMany(Vendor);
Vendor.belongsTo(Company);

Company.hasMany(Document);
Document.belongsTo(Company);

Customer.hasMany(Document);
Document.belongsTo(Customer);

Vendor.hasMany(Document);
Document.belongsTo(Vendor);

Document.hasOne(Invoice, {
  onDelete: "CASCADE",
});
Invoice.belongsTo(Document);

Invoice.hasMany(InvoiceLineItem);
InvoiceLineItem.belongsTo(Invoice);

Invoice.hasMany(InvoiceTax);
InvoiceTax.belongsTo(Invoice);

Document.hasOne(Purchase, {
  onDelete: "CASCADE",
});
Purchase.belongsTo(Document);

Purchase.hasMany(PurchaseLineItem);
PurchaseLineItem.belongsTo(Purchase);

Company.hasMany(SyncLog);
SyncLog.belongsTo(Company);

Integration.hasMany(SyncLog);
SyncLog.belongsTo(Integration);

Company.hasMany(EntityMapping);
EntityMapping.belongsTo(Company);

Integration.hasMany(EntityMapping);
EntityMapping.belongsTo(Integration);

Integration.hasMany(Document);
Document.belongsTo(Integration);

Document.hasOne(Purchase, {
  onDelete: "CASCADE",
});
Purchase.belongsTo(Document);

Purchase.hasMany(PurchaseLineItem);
PurchaseLineItem.belongsTo(Purchase);

Company.hasMany(SyncLog);
SyncLog.belongsTo(Company);

Integration.hasMany(SyncLog);
SyncLog.belongsTo(Integration);

Company.hasMany(EntityMapping);
EntityMapping.belongsTo(Company);

Integration.hasMany(EntityMapping);
EntityMapping.belongsTo(Integration);

User.hasMany(Company);
Company.belongsTo(User);

User.hasMany(Integration);
Integration.belongsTo(User);

User.hasMany(Customer);
Customer.belongsTo(User);

User.hasMany(Vendor);
Vendor.belongsTo(User);

User.hasMany(Document);
Document.belongsTo(User);

User.hasMany(Invoice);
Invoice.belongsTo(User);

User.hasMany(Purchase);
Purchase.belongsTo(User);

User.hasMany(SyncLog);
SyncLog.belongsTo(User);

User.hasMany(EntityMapping);
EntityMapping.belongsTo(User);

Invoice.belongsTo(Customer);
Customer.hasMany(Invoice);

Invoice.belongsTo(Company);
Company.hasMany(Invoice);

Purchase.belongsTo(Company);
Company.hasMany(Purchase);

Purchase.belongsTo(Vendor);
Vendor.hasMany(Purchase);

module.exports = {
  User,
  ChatHistory,
  Company,
  Integration,
  Customer,
  Vendor,
  Document,
  Invoice,
  InvoiceLineItem,
  InvoiceTax,
  Purchase,
  PurchaseLineItem,
  SyncLog,
  EntityMapping,
  sequelize,
  Sequelize,
  UserPlanMapping,
  SubscriptionHistory,
  PricingPlan,
};
