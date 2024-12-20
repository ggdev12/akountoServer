const {
  User,
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
  UserPlanMapping,
  SubscriptionHistory,
  PricingPlan,
  ChatHistory,
  sequelize,
} = require("./models");
const bcrypt = require("bcrypt");

const syncModels = async () => {
  try {
    console.log("Starting model synchronization...");
    await sequelize.sync({ alter: true, force: false });
    console.log("All models synchronized successfully.");
  } catch (error) {
    console.error("Error synchronizing models:", error);
    throw error;
  }
};

const createSampleData = async () => {
  try {
    console.log("Creating sample data...");

    // Create sample pricing plans
    const pricingPlans = [
      {
        name: "Starter",
        description: "Perfect for small businesses just getting started",
        price: 29.99,
        billing_cycle: "monthly",
        stripe_price_id: "price_1PXs39Ipsv0mU6RHD9uJQFJi",
        features: JSON.stringify({
          users: 5,
          documents: 100,
          quickbooks_sync: true,
          invoice_extraction: true,
          receipt_extraction: true,
          auto_matching: true,
        }),
      },
      {
        name: "Basic",
        description: "Ideal for growing businesses with moderate needs",
        price: 59.99,
        billing_cycle: "monthly",
        stripe_price_id: "price_1PXs3SIpsv0mU6RHkXy6gfFR",
        features: JSON.stringify({
          users: 10,
          documents: 200,
          quickbooks_sync: true,
          invoice_extraction: true,
          receipt_extraction: true,
          auto_matching: true,
        }),
      },
      {
        name: "Pro",
        description: "For established businesses requiring advanced features",
        price: 99.99,
        billing_cycle: "monthly",
        stripe_price_id: "price_1PJz3QIzZvKYlo2C1ZvkZjqP",
        features: JSON.stringify({
          users: 15,
          documents: 500,
          quickbooks_sync: true,
          invoice_extraction: true,
          receipt_extraction: true,
          auto_matching: true,
        }),
      },
    ];

    for (const plan of pricingPlans) {
      const [createdPlan, created] = await PricingPlan.findOrCreate({
        where: { name: plan.name },
        defaults: plan,
      });
      console.log(
        created
          ? `${plan.name} pricing plan created.`
          : `${plan.name} pricing plan already exists.`,
      );
    }

    // Create a sample user
    const [user, userCreated] = await User.findOrCreate({
      where: { email: "subhash@mydukaan.io" },
      defaults: {
        name: "Subhash",
        id: "10ad2357-4133-4067-be7b-6cdb3d7f2231",
        password: await bcrypt.hash("amit123", 10),
      },
    });
    console.log(
      userCreated ? "Sample user created." : "Sample user already exists.",
    );

    // Create a pricing plan mapping for the user with Pro plan
    const proPlan = await PricingPlan.findOne({ where: { name: "Pro" } });
    if (proPlan) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      const [userPlanMapping, userPlanMappingCreated] =
        await UserPlanMapping.findOrCreate({
          where: { UserId: user.id },
          defaults: {
            UserId: user.id,
            PricingPlanId: proPlan.id,
            start_date: startDate,
            end_date: endDate,
            status: "active",
          },
        });
      console.log(
        userPlanMappingCreated
          ? "User plan mapping created for Pro plan."
          : "User plan mapping already exists.",
      );

      // Create a subscription history entry for the user
      const [subscriptionHistory, subscriptionHistoryCreated] =
        await SubscriptionHistory.findOrCreate({
          where: { UserId: user.id },
          defaults: {
            UserId: user.id,
            PricingPlanId: proPlan.id,
            action: "subscribe",
            date: new Date(),
            details: "Initial subscription to Pro plan",
          },
        });
      console.log(
        subscriptionHistoryCreated
          ? "Subscription history entry created."
          : "Subscription history entry already exists.",
      );
    } else {
      console.log(
        "Pro plan not found. Unable to create user plan mapping and subscription history.",
      );
    }

    // Create a company for the sample user
    const [company, companyCreated] = await Company.findOrCreate({
      where: { companyName: "Sample Company" },
      defaults: {
        UserId: user.id,
        id: "7016abe9-d516-45df-b502-f0ee0f917cad",
      },
    });
    console.log(
      companyCreated
        ? "Sample company created."
        : "Sample company already exists.",
    );

    // Create a sample integration for the company
    const [integration, integrationCreated] = await Integration.findOrCreate({
      where: { name: "Sample Integration" },
      defaults: {
        CompanyId: company.id,
        service_type: "QuickBooks",
        status: "Connected",
        credentials: {},
        id: "7308a073-a2e9-466e-b859-e4ba1c7df45b",
      },
    });
    console.log(
      integrationCreated
        ? "Sample integration created."
        : "Sample integration already exists.",
    );
  } catch (error) {
    console.error("Error creating sample data:", error);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    await syncModels();
    await createSampleData();
    console.log("Database initialization completed successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

initializeDatabase();

module.exports = { initializeDatabase };
