const { Sequelize, DataTypes } = require('sequelize');

// Configure your database connection
const sequelize = new Sequelize('akounto_primary', 'postgres', 'gfRCHklku8k&ght', {
  host: '162.0.238.234',
  dialect: 'postgres'
});

// Define the PricingPlan model
const PricingPlan = sequelize.define('PricingPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  billing_cycle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stripe_price_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  features: {
    type: DataTypes.JSON,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  }
});

// Define the pricing plans data
const pricingPlans = [
  {
    name: "Starter",
    description: "Perfect for small businesses just getting started",
    price: 29.99,
    billing_cycle: "monthly",
    stripe_price_id: "price_1PXs39Ipsv0mU6RHD9uJQFJi",
    features: {
      users: 5,
      documents: 100,
      quickbooks_sync: true,
      invoice_extraction: true,
      receipt_extraction: true,
      auto_matching: true,
    }
  },
  {
    name: "Basic",
    description: "Ideal for growing businesses with moderate needs",
    price: 59.99,
    billing_cycle: "monthly",
    stripe_price_id: "price_1PXs3SIpsv0mU6RHkXy6gfFR",
    features: {
      users: 10,
      documents: 200,
      quickbooks_sync: true,
      invoice_extraction: true,
      receipt_extraction: true,
      auto_matching: true,
    }
  },
  {
    name: "Pro",
    description: "For established businesses requiring advanced features",
    price: 99.99,
    billing_cycle: "monthly",
    stripe_price_id: "price_1PJz3QIzZvKYlo2C1ZvkZjqP",
    features: {
      users: 15,
      documents: 500,
      quickbooks_sync: true,
      invoice_extraction: true,
      receipt_extraction: true,
      auto_matching: true,
    }
  }
];

// Function to create pricing plans
async function createPricingPlans() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync the model with the database
    await PricingPlan.sync();
    console.log('PricingPlan table created/synchronized.');

    // Create or update pricing plans
    for (const plan of pricingPlans) {
      const [createdPlan, created] = await PricingPlan.findOrCreate({
        where: { name: plan.name },
        defaults: plan
      });

      if (created) {
        console.log(`Created new pricing plan: ${plan.name}`);
      } else {
        // Update existing plan
        await createdPlan.update(plan);
        console.log(`Updated existing pricing plan: ${plan.name}`);
      }
    }

    console.log('All pricing plans have been created/updated successfully.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
    console.log('Database connection closed.');
  }
}

// Run the script
createPricingPlans();