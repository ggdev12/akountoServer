const express = require("express");
const router = express.Router();
const { upload, downloadFileAsBuffer } = require("./../services/storage");
const { Op, where } = require("sequelize");

const AI = require("../services/openai/index");

const appBaseURL = process.env.appBaseURL || "https://app.kounto.ai";

const {
  processDocument,
  processReceiptDocument,
} = require("./../services/processDocuments");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const secret = process.env.JWT_SECRET || "secret";

const {
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
  Sequelize,
  sequelize,
  PricingPlan,
  UserPlanMapping,
  SubscriptionHistory,
} = require("./../db/models/");
const e = require("express");
const QuickBooksSync = require("../channels/quickbooks");
const quickbooksApiClient = require("../channels/quickbooks/apiClient/quickbooksApiClient");

// User Authentication Routes

router.post("/auth/register", async (req, res) => {
  try {
    const existingUser = await User.findOne({
      where: { email: req.body.email },
    });
    if (existingUser) {
      res.status(400).json({ success: false, message: "Email already exists" });
      return;
    }
    const { password, ...userData } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ ...userData, password: hashedPassword });
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: "30d" });
    res.status(201).json({ success: true, token });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      user.password,
    );
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: "Incorrect password" });
      return;
    }
    const company = await Company.findOne({
      where: {
        UserId: user.id,
      },
    });
    if (!company) {
      res
        .status(404)
        .json({ success: false, message: "Company not found for this user" });
    }
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: "30d" });
    res.json({ success: true, token, companyId: company.id });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  jwt.verify(token, secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Add user context to the request
    req.user = await User.findByPk(decoded.id, {
      attributes: ["id", "email", "name"],
    });

    if (!req.user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    req.userId = decoded.id;
    next();
  });
};

router.get("/auth/account", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Company,
        },
      ],
    });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching account:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Initial auth route
router.get("/quickbooks/auth", authenticateToken, async (req, res) => {
  try {
    const companyId = req.query.id;

    // First, check if there's an existing integration
    const existingIntegration = await Integration.findOne({
      where: {
        CompanyId: companyId,
        service_type: "Quickbooks",
        status: "Connected",
      },
      order: [["createdAt", "DESC"]],
    });
    console.log("integration 1: ", existingIntegration);

    if (existingIntegration) {
      // Update existing integration's status to Disconnected
      await existingIntegration.update({
        status: "Disconnected",
        credentials: JSON.stringify({}),
      });
    }
    console.log("integration 2: ");

    const quickBookClient = new quickbooksApiClient({});
    console.log("integration 3: ");

    const integration = await Integration.create({
      name: "Quickbooks",
      service_type: "Quickbooks",
      credentials: JSON.stringify({}),
      status: "Disconnected",
      CompanyId: companyId,
      UserId: req.userId,
    });
    console.log("integration: ", integration);
    const authUri = await quickBookClient.getOAuthRedirectURL(integration.id);
    res.status(200).send(authUri);
  } catch (error) {
    console.error("Error while auth redirect:", error);
    res
      .status(500)
      .json({ error: "Failed to initiate QuickBooks authentication" });
  }
});

// Callback route
router.get("/quickbooks/callback", async (req, res) => {
  console.log("QuickBooks callback started");

  try {
    const parseRedirect = req.url;
    const quickBookClient = new quickbooksApiClient({});
    const { token } = await quickBookClient.createToken(parseRedirect);

    const credentials = {
      realmId: token.realmId,
      token_type: token.token_type,
      access_token: token.access_token,
      expires_in: token.expires_in,
      x_refresh_token_expires_in: token.x_refresh_token_expires_in,
      refresh_token: token.refresh_token,
      id_token: token.id_token,
      latency: token.latency,
      createdAt: token.createdAt,
    };

    // Update the integration with credentials AND status
    await Integration.update(
      {
        credentials: credentials,
        status: "Connected", // Set status to Connected when we get credentials
      },
      {
        where: { id: req.query.state },
      },
    );

    const integration = await Integration.findByPk(req.query.state);

    if (credentials) {
      const quickbooks = new QuickBooksSync(
        credentials,
        integration.CompanyId,
        integration.id,
        integration.UserId,
      );

      await quickbooks.sync();
    }

    res.status(200).redirect(`${appBaseURL}/sales`);
  } catch (error) {
    console.error("Error while syncing data:", error);

    // Update integration status to Disconnected if there's an error
    if (req.query.state) {
      await Integration.update(
        {
          status: "Disconnected",
          credentials: JSON.stringify({}),
        },
        {
          where: { id: req.query.state },
        },
      );
    }

    res
      .status(500)
      .redirect(`${appBaseURL}/settings/integrations?error=auth_failed`);
  }
});

// Company Routes
router.get("/companies", authenticateToken, async (req, res) => {
  try {
    const companies = await Company.findAll({ where: { UserId: req.userId } });
    res.json({ success: true, companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/companies", authenticateToken, async (req, res) => {
  console.log("UserId :", req.userId);
  try {
    const company = await Company.create({ ...req.body, UserId: req.userId });
    res.status(201).send(company);
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
});

router.get("/companies/:id", authenticateToken, async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { id: req.params.id, UserId: req.userId },
      // include: [Integration, Customer, Vendor, Document, Invoice, Purchase, SyncLog],
    });
    if (!company) {
      throw new Error("Company not found");
    }
    res.send(company);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.put("/companies/:id", authenticateToken, async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { id: req.params.id, UserId: req.userId },
    });
    if (!company) {
      throw new Error("Company not found");
    }
    await company.update(req.body);
    res.send(company);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.delete("/companies/:id", authenticateToken, async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { id: req.params.id, UserId: req.userId },
    });
    if (!company) {
      throw new Error("Company not found");
    }
    await company.destroy();
    res.send({ message: "Company deleted successfully" });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.get(
  "/companies/:companyId/integrations",
  authenticateToken,
  async (req, res) => {
    try {
      console.log("company id for finding integrations:", req.params.companyId);

      const company = await Company.findOne({
        where: {
          id: req.params.companyId,
          UserId: req.userId,
        },
      });

      if (!company) {
        console.log("Company not found for Integrations");
        return res.status(404).json({ error: "Company not found" });
      }

      // Find latest integration for QuickBooks using correct column name 'service_type'
      const integration = await Integration.findOne({
        where: {
          CompanyId: req.params.companyId,
          service_type: "Quickbooks", // Changed from 'type' to 'service_type'
        },
        order: [["createdAt", "DESC"]],
      });

      if (!integration) {
        return res.status(200).json({
          integrationStatus: "Disconnected",
          hasActiveIntegration: false,
          message: "No QuickBooks integration found",
        });
      }

      // Parse the credentials JSON string
      let credentials;
      try {
        credentials = JSON.parse(integration.credentials);
      } catch (e) {
        credentials = {};
      }

      // Check if credentials exist and have required fields
      const hasValidCredentials =
        credentials && credentials.realmId && credentials.access_token;

      res.json({
        hasActiveIntegration: hasValidCredentials,
        integrationStatus: integration.status, // Added status to response
        message: hasValidCredentials
          ? "Active QuickBooks integration found"
          : "QuickBooks integration exists but is not active",
      });
    } catch (error) {
      console.error("Error checking integrations:", error);
      res.status(500).json({
        error: "Failed to check integration status",
        message: error.message,
      });
    }
  },
);
// Integration Routes
router.post(
  "/companies/:companyId/integrations",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const integration = await Integration.create({
        ...req.body,
        CompanyId: req.params.companyId,
      });
      console.log(integration);
      res.status(201).send(integration);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/integrations/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const integration = await Integration.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!integration) {
        throw new Error("Integration not found");
      }
      res.send(integration);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/integrations/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const integration = await Integration.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!integration) {
        throw new Error("Integration not found");
      }
      await integration.update(req.body);
      res.send(integration);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.delete(
  "/companies/:companyId/integrations/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }

      console.log("company id:", req.params.companyId, "user -->>", req.userId);
      await Integration.destroy({
        where: {
          CompanyId: req.params.companyId,
          UserId: req.userId,
        },
      });
      res.send({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(400).send(error.message);
    }
  },
);

// Customer Routes
router.get(
  "/companies/:companyId/customers",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 customers per page
      const page = parseInt(req.query.page) || 1; // Default page number to 1
      const offset = (page - 1) * limit;
      const nameSearch = req.query.name
        ? { name: { [Op.like]: `%${req.query.name}%` } }
        : {};
      const customersResult = await Customer.findAndCountAll({
        where: { CompanyId: req.params.companyId, ...nameSearch },
        limit: limit,
        offset: offset,
      });
      const totalPages = Math.ceil(customersResult.count / limit);
      res.send({
        stats: {
          totalCount: customersResult.count,
          currentPage: page,
          totalPages: totalPages,
        },
        results: customersResult.rows,
      });
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.post(
  "/companies/:companyId/customers",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      // creating customer in quickbooks
      console.log("syncing customer...", req.body, integration.id);
      const quickbooksApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const response = await quickbooksApi.customers.create({
        FullyQualifiedName: req.body.name,
        PrimaryEmailAddr: {
          Address: req.body.email,
        },
        DisplayName: req.body.name,

        PrimaryPhone: {
          FreeFormNumber: req.body.phone,
        },
        CompanyName: "",
        BillAddr: {
          CountrySubDivisionCode: req.body.billing_address.State,
          City: req.body.billing_address.City,
          PostalCode: req.body.billing_address.ZipCode,
          Line1: req.body.billing_address.Line1,
          Country: "",
        },
        ShipAddr: {
          CountrySubDivisionCode: req.body.shipping_address.State,
          City: req.body.billing_address.City,
          PostalCode: req.body.billing_address.ZipCode,
          Line1: req.body.billing_address.Line1,
          Country: "",
        },
      });

      console.log(
        "sync done...",
        response.body.Customer,
        response.body.Customer.Id,
      );

      const customer = await Customer.create({
        ...req.body,
        shipping_address: JSON.stringify({}),
        CompanyId: req.params.companyId,
        UserId: company.UserId,
      });

      console.log(
        "customer",
        customer.dataValues,
        customer.dataValues.id,
        "integration",
        integration,
      );

      const entity = await EntityMapping.create({
        entity_type: "Customer",
        external_id: response.body.Customer.Id,
        local_id: customer.dataValues.id,
        CompanyId: req.params.companyId,
        IntegrationId: integration.id,
        UserId: req.userId,
      });

      console.log("entity created...", entity);
      res.status(201).send(customer);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/customers/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const customer = await Customer.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!customer) {
        throw new Error("Customer not found");
      }
      res.send(customer);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/customers/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      const customer = await Customer.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      // updating customer in quickbooks
      const quickbooksApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const entity = await EntityMapping.findOne({
        where: {
          local_id: req.params.id,
          CompanyId: req.params.companyId,
          entity_type: "Customer",
        },
      });

      const customerData = await quickbooksApi.customers.getCustomer(
        entity.external_id,
      );

      const quickbooksCustomer = customerData.body.QueryResponse.Customer[0];

      const response = await quickbooksApi.customers.update({
        DisplayName: req.body.name,
        SyncToken: quickbooksCustomer.SyncToken,
        Id: entity.external_id,
        PrimaryEmailAddr: {
          Address: req.body.email,
        },
        PrimaryPhone: {
          FreeFormNumber: req.body.phone,
        },
        BillAddr: {
          City: req.body.billing_address.City,
          Line1: req.body.billing_address.Line1,
          PostalCode: req.body.billing_address.ZipCode,
          CountrySubDivisionCode: req.body.billing_address.State,
        },
        ShipAddr: {
          City: req.body.shipping_address.City,
          Line1: req.body.shipping_address.Line1,
          PostalCode: req.body.shipping_address.ZipCode,
          CountrySubDivisionCode: req.body.shipping_address.State,
        },
        sparse: true,
      });

      console.log("updating finished");

      await customer.update(req.body);

      res.send(customer);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.delete(
  "/companies/:companyId/customers/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const customer = await Customer.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!customer) {
        throw new Error("Customer not found");
      }
      await customer.destroy();
      res.send({ message: "Customer deleted successfully" });
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

// Vendor Routes

router.get(
  "/companies/:companyId/vendors",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const limit = parseInt(req.query.limit) || 10; // Default limit to 10 vendors per page
      const page = parseInt(req.query.page) || 1; // Default page number to 1
      const offset = (page - 1) * limit;
      const nameSearch = req.query.name
        ? { name: { [Op.like]: `%${req.query.name}%` } }
        : {};
      const vendorsResult = await Vendor.findAndCountAll({
        where: { CompanyId: req.params.companyId, ...nameSearch },
        limit: limit,
        offset: offset,
      });
      const totalPages = Math.ceil(vendorsResult.count / limit);
      res.send({
        stats: {
          totalCount: vendorsResult.count,
          currentPage: page,
          totalPages: totalPages,
        },
        results: vendorsResult.rows,
      });
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.post(
  "/companies/:companyId/vendors",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      // creating vendor in quickbooks
      const quickbooksApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const response = await quickbooksApi.vendors.create({
        PrimaryEmailAddr: {
          Address: req.body.email,
        },
        WebAddr: {
          URI: "",
        },
        PrimaryPhone: {
          FreeFormNumber: req.body.phone,
        },
        DisplayName: req.body.name,
        Suffix: ".",
        Title: "",
        Mobile: {
          FreeFormNumber: req.body.phone,
        },
        FamilyName: "",
        TaxIdentifier: "",
        AcctNum: "",
        CompanyName: req.body.name,
        BillAddr: {
          City: req.body.address.City,
          Country: "",
          Line3: "",
          Line2: "",
          Line1: req.body.address.Line1,
          PostalCode: req.body.address.ZipCode,
          CountrySubDivisionCode: req.body.address.State,
        },
        GivenName: "",
        PrintOnCheckName: "",
      });

      const vendor = await Vendor.create({
        ...req.body,
        CompanyId: req.params.companyId,
        UserId: company.UserId,
      });

      console.log("vendor", vendor);

      await EntityMapping.create({
        entity_type: "Vendor",
        external_id: response.body.Customer.Id,
        local_id: vendor.dataValues.id,
        CompanyId: req.params.companyId,
        IntegrationId: integration.id,
        UserId: req.userId,
      });
      res.status(201).send(vendor);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/vendors/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const vendor = await Vendor.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!vendor) {
        throw new Error("Vendor not found");
      }
      res.send(vendor);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/vendors/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      // updating vendor in quickbooks
      const quickbooksApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const entity = await EntityMapping.findOne({
        where: {
          local_id: req.params.id,
          CompanyId: req.params.companyId,
          entity_type: "Vendor",
        },
      });

      const vendorData = await quickbooksApi.vendors.getVendor(
        entity.external_id,
      );

      const quickbooksVendor = vendorData.Vendor[0];

      const response = await quickbooksApi.vendors.update({
        Id: entity.external_id,
        SyncToken: quickbooksVendor.SyncToken,
        PrimaryEmailAddr: {
          Address: req.body.email,
        },
        PrimaryPhone: {
          FreeFormNumber: req.body.phone,
        },
        DisplayName: req.body.name,

        Mobile: {
          FreeFormNumber: req.body.phone,
        },
        CompanyName: req.body.name,
        BillAddr: {
          City: req.body.address.City,
          Country: "",
          Line3: "",
          Line2: "",
          Line1: req.body.address.Line1,
          PostalCode: req.body.address.ZipCode,
          CountrySubDivisionCode: req.body.address.State,
        },
      });

      console.log("created...");

      const vendor = await Vendor.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!vendor) {
        throw new Error("Vendor not found");
      }
      await vendor.update(req.body);
      res.send(vendor);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.delete(
  "/companies/:companyId/vendors/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const vendor = await Vendor.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!vendor) {
        throw new Error("Vendor not found");
      }
      await vendor.destroy();
      res.send({ message: "Vendor deleted successfully" });
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

// Document Routes

const validateUploadRequest = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    if (!req.body.type || !["Invoice", "Receipt"].includes(req.body.type)) {
      return res.status(400).json({
        error: "Invalid document type. Must be 'Invoice' or 'Receipt'.",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Integration helper
async function ensureCompanyIntegration(company, transaction) {
  if (!company.Integrations || company.Integrations.length === 0) {
    await Integration.create(
      {
        name: "Default Integration",
        type: "DEFAULT",
        status: "ACTIVE",
        CompanyId: company.id,
        UserId: company.UserId,
      },
      { transaction },
    );

    return await Company.findOne({
      where: { id: company.id },
      include: [Integration],
      transaction,
    });
  }
  return company;
}

router.post(
  "/companies/:companyId/documents/upload",
  authenticateToken,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("File upload error:", err);
        return res.status(500).json({
          error: "File upload failed",
          details: err.message,
        });
      }
      next();
    });
  },
  validateUploadRequest,
  async (req, res) => {
    const transaction = await sequelize.transaction();
    console.log("Starting document processing...");

    try {
      console.log("CompanyID:", req.params.companyId, "UserID:", req.userId);

      // Find company with transaction
      let company = await Company.findOne({
        where: {
          id: req.params.companyId,
          UserId: req.userId,
        },
        include: [Integration],
        transaction,
      });

      if (!company) {
        await transaction.rollback();
        return res.status(404).json({ error: "Company not found" });
      }

      // Ensure company has integration
      company = await ensureCompanyIntegration(company, transaction);
      const integrationId = company.Integrations[0].id;

      console.log("Creating document record...");
      const document = await Document.create(
        {
          type: req.body.type,
          status: "Inbox",
          file_path: req.file.location,
          CompanyId: req.params.companyId,
          UserId: req.userId,
          IntegrationId: integrationId,
        },
        { transaction },
      );

      console.log("Creating entity mapping...");
      const entityMapping = await EntityMapping.create(
        {
          entity_type: "Document",
          external_id: req.file.filename,
          local_id: document.id,
          CompanyId: req.params.companyId,
          UserId: req.userId,
          IntegrationId: integrationId,
        },
        { transaction },
      );

      console.log("Creating sync log...");
      await SyncLog.create(
        {
          entity_type: "Document",
          sync_date: new Date(),
          entityMappingId: entityMapping.id,
          text_job_description: `${req.body.type} - ${document.id} - Process and push`,
          sync_status: "Queued",
          CompanyId: req.params.companyId,
          UserId: req.userId,
          IntegrationId: integrationId,
        },
        { transaction },
      );

      // Commit transaction
      await transaction.commit();
      console.log("Transaction committed successfully");

      // Process document after transaction is committed
      try {
        console.log("Starting document processing...");
        if (document.type === "Invoice") {
          await processDocument(document);
        } else {
          await processReceiptDocument(document);
        }

        return res.status(201).json({
          message: "Document uploaded and processed successfully",
          document: document,
        });
      } catch (processingError) {
        console.error("Document processing failed:", processingError);

        // Update document status on processing error
        await Document.update(
          {
            status: "ProcessingError",
            error_message: processingError.message,
          },
          {
            where: { id: document.id },
          },
        );

        return res.status(201).json({
          message: "Document uploaded but processing failed",
          document: document,
          error: processingError.message,
        });
      }
    } catch (error) {
      console.error("Transaction error:", error);
      await transaction.rollback();

      return res.status(500).json({
        error: "Failed to process document",
        details: error.message,
      });
    }
  },
);
router.post(
  "/companies/:companyId/documents",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const document = await Document.create({
        ...req.body,
        CompanyId: req.params.companyId,
        UserId: req.userId,
      });
      res.status(201).send(document);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/documents",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      // Adding a filter for document type if provided in the query parameters
      const query = { CompanyId: req.params.companyId };
      if (req.query.type) {
        query.type = req.query.type;
      }

      if (req.query.status) {
        query.status = req.query.status;
      }

      // Pagination setup
      const limit = parseInt(req.query.limit, 10) || 10; // default limit to 10 docs per page
      const page = parseInt(req.query.page, 10) || 1; // default page number to 1
      const offset = (page - 1) * limit;

      const { count, rows: documents } = await Document.findAndCountAll({
        where: query,
        include: [Purchase, Invoice],
        limit,
        offset,
      });

      if (!documents.length) {
        return res.status(404).send({
          message:
            "No documents found for this company with the specified type",
        });
      }

      for (const document of documents) {
        if (document.type === "Invoice") {
          const invoice = await Invoice.findOne({
            where: { DocumentId: document.id },
            include: [
              { model: Customer, as: "Customer" },
              { model: Company, as: "Company" },
              { model: InvoiceLineItem, as: "InvoiceLineItems" },
              { model: InvoiceTax, as: "InvoiceTaxes" },
            ],
          });

          document.dataValues.Invoice = invoice;
        }

        if (document.type === "Receipt") {
          const purchase = await Purchase.findOne({
            where: { DocumentId: document.id },
            include: [
              { model: Company, as: "Company" },
              { model: PurchaseLineItem, as: "PurchaseLineItems" },
              { model: Vendor, as: "Vendor" },
            ],
          });
          document.dataValues.Purchase = purchase;
        }
      }

      // Adding pagination data to the response
      const totalPages = Math.ceil(count / limit);
      res.status(200).send({
        documents,
        pagination: {
          totalItems: count,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      console.log(error);
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/documents/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const document = await Document.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!document) {
        throw new Error("Document not found");
      }
      if (document.type === "Invoice") {
        const invoice = await Invoice.findOne({
          where: { DocumentId: req.params.id },
          include: [
            { model: Customer, as: "Customer" },
            { model: Company, as: "Company" },
            { model: InvoiceLineItem, as: "InvoiceLineItems" },
            { model: InvoiceTax, as: "InvoiceTaxes" },
          ],
        });
        if (!invoice) {
          throw new Error("Invoice not found for this document");
        }
        document.dataValues.invoice = invoice; // Append invoice object to the document object
      }

      if (document.type === "Receipt") {
        const receipt = await Purchase.findOne({
          where: { DocumentId: req.params.id },
          include: [
            { model: Company, as: "Company" },
            { model: PurchaseLineItem, as: "PurchaseLineItems" },
            { model: Vendor, as: "Vendor" },
          ],
        });

        if (!receipt) {
          throw new Error("Receipt not found for this document");
        }
        document.dataValues.receipt = receipt;
      }

      res.send(document);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/documentstats",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }

      const documentType = req.query.type;
      if (!documentType) {
        throw new Error("Document type is required");
      }

      const stats = await Document.findAll({
        where: {
          CompanyId: req.params.companyId,
          type: documentType,
        },
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("status")), "count"],
        ],
        group: ["status"],
      });
      if (!stats) {
        return res.status(400).json({ message: "No data found" });
      }
      res.status(200).send(stats);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/documents/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      res.send(document);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.delete(
  "/companies/:companyId/documents/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const document = await Document.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!document) {
        throw new Error("Document not found");
      }
      await document.destroy();
      res.send({ message: "Document deleted successfully" });
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

// Invoice Routes
router.post(
  "/companies/:companyId/invoice",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const invoice = await Invoice.create({
        ...req.body,
        CompanyId: req.params.companyId,
      });
      res.status(201).send(invoice);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/missing/invoices/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        invoice_number,
        date,
        due_date,
        total_amount,
        notes,
        ship_address,
        bill_address,
        CustomerId,
        items,
      } = req.body;

      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      const invoice = await Invoice.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });

      const document = await Document.findOne({
        where: { id: invoice.DocumentId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (!document) {
        throw new Error("Document not found");
      }

      const quickbooksApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const customerEntity = await EntityMapping.findOne({
        where: {
          CompanyId: req.params.companyId,
          entity_type: "Customer",
          local_id: CustomerId,
        },
      });

      const line = items.map((item) => {
        let amount = item.unit_price * item.quantity;

        return {
          Description: item.description,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            TaxCodeRef: {
              value: "TAX",
            },
            Qty: item.quantity,
            UnitPrice: item.unit_price,
          },
          Amount: amount,
        };
      });

      const response = await quickbooksApi.invoices.create({
        Line: line,
        CurrencyRef: {
          value: "USD",
        },
        DocNumber: invoice_number,
        BillAddr: !bill_address
          ? {}
          : {
              Line1: bill_address.Line1,
              CountrySubDivisionCode: bill_address.State,

              City: bill_address.City,
              PostalCode: bill_address.ZipCode,
            },
        ShipAddr: !ship_address
          ? {}
          : {
              Line1: ship_address.Line1 ?? "",
              CountrySubDivisionCode: ship_address.State ?? "",
              City: ship_address.City ?? "",
              PostalCode: ship_address.ZipCode ?? "",
            },
        SalesTermRef: {
          value: "",
        },
        TxnDate: date,
        DueDate: due_date,
        TotalAmt: total_amount ?? "",
        CustomerMemo: {
          value: notes ?? "",
        },
        CustomerRef: {
          value: customerEntity.external_id,
        },
      });

      console.log("creating finished", response.body);

      await invoice.update({
        invoice_number,
        date,
        due_date,
        total_amount,
        notes,
        ship_address,
        bill_address,
        CustomerId,
      });

      document.update({
        status: "Ready",
      });
      res.send(invoice);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/invoices/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const invoice = await Invoice.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!invoice) {
        throw new Error("Invoice not found");
      }
      res.send(invoice);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/invoices/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        invoice_number,
        date,
        due_date,
        total_amount,
        notes,
        ship_address,
        bill_address,
        CustomerId,
        items,
      } = req.body;

      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      if (!company) {
        throw new Error("Company not found");
      }
      const invoice = await Invoice.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const entity = await EntityMapping.findOne({
        where: {
          local_id: req.params.id,
          entity_type: "Invoice",
          CompanyId: req.params.companyId,
        },
      });

      const customerEntity = await EntityMapping.findOne({
        where: {
          local_id: CustomerId,
          entity_type: "Customer",
          CompanyId: req.params.companyId,
        },
      });

      // updating invoice in quickbooks
      const quickbookApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const quickbookInvoice = await quickbookApi.invoices.get(
        entity.external_id,
      );

      console.log("externalId :", entity.external_id);

      const response = await quickbookApi.invoices.update({
        SyncToken: quickbookInvoice.SyncToken,
        Id: quickbookInvoice.Id,
        CurrencyRef: {
          value: "USD",
        },
        DocNumber: invoice_number,
        TxnDate: date,
        DueDate: due_date,
        BillAddr: {
          Line1: bill_address.Line1,
          City: bill_address.City,
          CountrySubDivisionCode: bill_address.State,
          PostalCode: bill_address.ZipCode,
        },
        ShipAddr: {
          Line1: ship_address.Line1,
          City: ship_address.City,
          CountrySubDivisionCode: ship_address.State,
          PostalCode: ship_address.ZipCode,
        },
        CustomerMemo: {
          value: notes ?? "",
        },
        CustomerRef: {
          value: customerEntity.external_id,
        },
        Line: quickbookInvoice.Line,
        sparse: true,
      });

      console.log("Done...");

      await invoice.update({
        invoice_number,
        date,
        due_date,
        total_amount,
        notes,
        ship_address,
        bill_address,
        CustomerId,
      });

      for (const item of items) {
        await InvoiceLineItem.update(
          {
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total_amount,
            description: item.description,
          },
          {
            where: {
              id: item.id,
            },
          },
        );
      }
      res.send(invoice);
    } catch (error) {
      console.error(error);
      res.status(400).send(error.message);
    }
  },
);

// Expenses routes
router.post(
  "/companies/:companyId/expense",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const invoice = await Purchase.create({
        ...req.body,
        CompanyId: req.params.companyId,
      });
      res.status(201).send(invoice);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.get(
  "/companies/:companyId/expenses/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
        include: [{ model: Vendor, as: "Vendor" }],
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const purchase = await Purchase.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!purchase) {
        throw new Error("Expense not found");
      }

      res.send(purchase);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/missing/expenses/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { total_amount, account_ref, txn_date, items, VendorId } = req.body;

      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: req.params.companyId },
      });

      const receipt = await Purchase.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });

      const document = await Document.findOne({
        where: { id: receipt.DocumentId },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      if (!receipt) {
        throw new Error("Purchase not found");
      }

      if (!document) {
        throw new Error("Document not found");
      }

      const quickbooksApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const vendorEntity = await EntityMapping.findOne({
        where: {
          CompanyId: req.params.companyId,
          entity_type: "Vendor",
          local_id: VendorId,
        },
      });

      const response = await quickbooksApi.expenses.create({
        Line: items.map((item) => {
          return {
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: item.amount,

            AccountBasedExpenseLineDetail: {
              AccountRef: {
                value: item.account_ref,
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
        PaymentType: "Cash",
        AccountRef: {
          value: account_ref,
        },
        TxnDate: txn_date,
        TotalAmt: total_amount,
        EntityRef: {
          value: vendorEntity.external_id,
        },
      });

      console.log("creating finished", response);

      await receipt.update(req.body);

      document.update({
        status: "Ready",
      });
      res.send(receipt);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.put(
  "/companies/:companyId/expenses/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { total_amount, account_ref, txn_date, items } = req.body;

      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });

      const integration = await Integration.findOne({
        where: { CompanyId: company.id },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!integration) {
        throw new Error("Integration not found");
      }

      const quickbookApi = new quickbooksApiClient(
        integration.credentials,
        integration.id,
      );

      const receiptEntity = await EntityMapping.findOne({
        where: {
          local_id: req.params.id,
          entity_type: "Receipt",
          CompanyId: req.params.companyId,
        },
      });

      const vendorEntity = await EntityMapping.findOne({
        where: {
          local_id: req.body.VendorId,
          entity_type: "Vendor",
          CompanyId: req.params.companyId,
        },
      });

      const purchase = await Purchase.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });

      if (!purchase) {
        throw new Error("Expense not found");
      }

      // update the expense in quickbooks

      const quickbooksPurchase = await quickbookApi.expenses.get(
        receiptEntity.external_id,
      );

      const response = await quickbookApi.expenses.update({
        Id: receiptEntity.external_id,
        SyncToken: quickbooksPurchase.SyncToken,
        Line: quickbooksPurchase.Line,
        TotalAmt: total_amount,
        TxnDate: txn_date,
        PaymentType: quickbooksPurchase.PaymentType,
        AccountRef: {
          value: account_ref,
        },
        EntityRef: {
          value: vendorEntity.external_id,
        },
        sparse: true,
      });

      console.log("done...", response.Purchase.Line);

      await purchase.update(req.body);
      res.send(req.body);
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

router.delete(
  "/companies/:companyId/expenses/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        where: { id: req.params.companyId, UserId: req.userId },
      });
      if (!company) {
        throw new Error("Company not found");
      }
      const purchase = await Purchase.findOne({
        where: { id: req.params.id, CompanyId: req.params.companyId },
      });
      if (!purchase) {
        throw new Error("Expense not found");
      }
      await purchase.destroy();
      res.send({ message: "Expense deleted successfully" });
    } catch (error) {
      res.status(400).send(error.message);
    }
  },
);

// Pricing Plan Routes

// Account Routes

router.get("/account", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.userId },
      attributes: ["name", "email"],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching account details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.put("/account", authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      return res
        .status(400)
        .json({ success: false, message: "No update data provided" });
    }

    const user = await User.findByPk(req.userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    res.json({
      success: true,
      message: "Account updated successfully",
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Error updating account details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get(
  "/account/subscription/plans",
  authenticateToken,
  async (req, res) => {
    try {
      console.log("req.userId", req.userId);

      const pricingPlans = await PricingPlan.findAll();
      const userPlanMapping = await UserPlanMapping.findOne({
        where: {
          UserId: req.userId,
          status: "active",
        },
        order: [["createdAt", "DESC"]],
      });

      const plansWithActiveStatus = pricingPlans.map((plan) => ({
        ...plan.toJSON(),
        isUserCurrentPlan: userPlanMapping
          ? userPlanMapping.PricingPlanId === plan.id
          : false,
      }));

      res.json({ success: true, plans: plansWithActiveStatus });
    } catch (error) {
      console.error("Error fetching pricing plans:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

router.get(
  "/account/subscription/history",
  authenticateToken,
  async (req, res) => {
    try {
      const subscriptionHistory = await SubscriptionHistory.findAll({
        where: { UserId: req.userId },
        include: [
          {
            model: PricingPlan,
            attributes: ["name", "price", "billing_cycle"],
          },
        ],
        order: [["date", "DESC"]],
      });

      res.json({ success: true, history: subscriptionHistory });
    } catch (error) {
      console.error("Error fetching subscription history:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

const stripe = require("stripe")(
  "sk_test_51PXqaQIpsv0mU6RHqbkcmqh4VDL8SzsXyQwVqbHvxDUrwvUgKW4ARFY6dOOV9BTVY88iJYf8fVHq0tH1aRRjsMKR00jkRcF3NW",
);

router.post(
  "/account/subscription/start-trial",
  authenticateToken,
  async (req, res) => {
    try {
      const { cardToken } = req.body;

      if (!cardToken) {
        return res
          .status(400)
          .json({ success: false, message: "Card token is required" });
      }
      console.log("cardToken --->>>", cardToken);

      // Create a customer in Stripe
      const customer = await stripe.customers.create({
        source: cardToken,
        email: req.user.email, // Assuming the user's email is available in req.user
      });

      console.log("subsc customer creating --->>", customer);

      // Start a subscription with a 14-day trial
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: "price_1PXs39Ipsv0mU6RHD9uJQFJi" }], // Starter plan price ID
        trial_period_days: 14,
      });

      console.log("subscription creating --->>>>", subscription);

      // Update user's subscription information in your database
      // Find the 'Starter' plan in the database

      const plans = await PricingPlan.findAll();
      console.log("All plans:", plans);

      const starterPlan = await PricingPlan.findOne({
        where: { name: "Starter" },
      });

      if (!starterPlan) {
        throw new Error("Starter plan not found");
      }

      await UserPlanMapping.create({
        UserId: req.userId,
        PricingPlanId: starterPlan.id,
        status: "active",
        start_date: new Date(),
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        isFreeTrial: true,
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
      });

      // Create a subscription history entry
      await SubscriptionHistory.create({
        UserId: req.userId,
        PricingPlanId: starterPlan.id,
        action: "freeTrial",
        date: new Date(),
        details: `Started 14-day free trial`,
      });

      res.json({ success: true, message: "Trial started successfully" });
    } catch (error) {
      console.error("Error starting trial:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

router.post(
  "/account/subscription/change-plan",
  authenticateToken,
  async (req, res) => {
    try {
      const { priceId } = req.body;
      console.log(`Changing plan - Price ID: ${priceId}`);

      if (!priceId) {
        console.log("Error: Price ID is missing");
        return res
          .status(400)
          .json({ success: false, message: "Price ID is required" });
      }

      // Find the user's active subscription
      console.log(`Finding active subscription for user: ${req.userId}`);
      const activeSubscription = await UserPlanMapping.findOne({
        where: {
          UserId: req.userId,
          status: "active",
        },
      });

      if (!activeSubscription) {
        console.log(`No active subscription found for user: ${req.userId}`);
        return res
          .status(404)
          .json({ success: false, message: "No active subscription found" });
      }
      console.log(`Active subscription found: ${activeSubscription.id}`);

      // Find the current plan
      console.log(
        `Finding current plan for subscription: ${activeSubscription.PricingPlanId}`,
      );
      const currentPlan = await PricingPlan.findByPk(
        activeSubscription.PricingPlanId,
      );
      if (!currentPlan) {
        console.log(
          `Error: Current plan not found for ID: ${activeSubscription.PricingPlanId}`,
        );
        throw new Error("Current plan not found");
      }
      console.log(`Current plan found: ${currentPlan.name}`);

      // Retrieve the Stripe subscription
      console.log(
        `Retrieving Stripe subscription: ${activeSubscription.stripeSubscriptionId}`,
      );
      const subscription = await stripe.subscriptions.retrieve(
        activeSubscription.stripeSubscriptionId,
      );
      console.log("Stripe subscription retrieved successfully");

      // Update the subscription with the new price
      console.log(`Updating Stripe subscription with new price: ${priceId}`);
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.id,
        {
          items: [{ id: subscription.items.data[0].id, price: priceId }],
          proration_behavior: "always_invoice",
        },
      );
      console.log("Stripe subscription updated successfully");

      // Find the new plan in the database
      console.log(
        `Finding new plan in database with Stripe Price ID: ${priceId}`,
      );
      const newPlan = await PricingPlan.findOne({
        where: { stripe_price_id: priceId },
      });

      if (!newPlan) {
        console.log(
          `Error: New plan not found for Stripe Price ID: ${priceId}`,
        );
        throw new Error("New plan not found");
      }
      console.log(`New plan found: ${newPlan.id}`);

      // Update the user's subscription information in the database
      console.log(`Updating user's subscription information in database`);
      await activeSubscription.update({
        PricingPlanId: newPlan.id,
        isFreeTrial: false,
        trialStart: null,
        trialEnd: null,
      });
      console.log("User subscription information updated successfully");

      // Determine if it's an upgrade or downgrade
      const action =
        newPlan.price > currentPlan.price ? "upgrade" : "downgrade";

      // Create a subscription history entry
      console.log("Creating subscription history entry");
      await SubscriptionHistory.create({
        UserId: req.userId,
        PricingPlanId: newPlan.id,
        action: action,
        date: new Date(),
        details: `Changed subscription from ${currentPlan.name} to ${newPlan.name}`,
      });
      console.log("Subscription history entry created successfully");

      console.log("Subscription change process completed successfully");
      res.json({
        success: true,
        message: `Subscription ${action}d successfully`,
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// biswasys[ignore this]
// Sending the Documents data for the dashboard.

router.get("/dashboard-data", authenticateToken, async (req, res) => {
  try {
    // finding the user
    const findUser = await User.findOne({
      where: { id: req.userId },
      include: [Company],
    });
    // if user does not exist then return
    if (!findUser) {
      return res.status(400).json({ message: "User not available" });
    }

    const company = findUser.Company;
    //console.log("company", company);

    // finding all documents for the user
    const userDocuments = await Document.findAll({
      where: {
        UserId: req.userId,
      },
    });

    const totalUserDocuments = userDocuments.length;
    const completedUserDocuments = userDocuments.filter(
      (doc) => doc.status === "Processed" || doc.status === "Ready",
    ).length;
    const pendingUserDocuments = totalUserDocuments - completedUserDocuments;
    const userSuccessRate = (
      (completedUserDocuments / totalUserDocuments) *
      100
    ).toFixed(2);

    let totalCompanyDocuments = totalUserDocuments;
    let completedCompanyDocuments = completedUserDocuments;
    let pendingCompanyDocuments = pendingUserDocuments;
    let companySuccessRate = userSuccessRate;
    let totalCompanyUsers = 1;
    let invoiceUsage = 0;
    let receiptUsage = 0;
    let totalDocsUsage = 0;

    if (company) {
      // finding all documents for the company
      const companyDocuments = await Document.findAll({
        where: {
          CompanyId: company.id,
        },
      });

      totalCompanyDocuments = companyDocuments.length;
      completedCompanyDocuments = companyDocuments.filter(
        (doc) => doc.status === "Processed" || doc.status === "Ready",
      ).length;
      pendingCompanyDocuments =
        totalCompanyDocuments - completedCompanyDocuments;
      companySuccessRate = (
        (completedCompanyDocuments / totalCompanyDocuments) *
        100
      ).toFixed(2);

      // finding all users linked with the company
      const companyUsers = await User.findAll({
        where: {
          CompanyId: company.id,
        },
      });

      totalCompanyUsers = companyUsers.length;

      // calculating plan usage percentages
      const maxLimit = 100;
      const invoiceCount = companyDocuments.filter(
        (doc) => doc.type === "Invoice",
      ).length;
      const receiptCount = companyDocuments.filter(
        (doc) => doc.type === "Receipt",
      ).length;
      const totalDocsCount = totalCompanyDocuments;

      invoiceUsage = ((invoiceCount / maxLimit) * 100).toFixed(2);
      receiptUsage = ((receiptCount / maxLimit) * 100).toFixed(2);
      totalDocsUsage = ((totalDocsCount / maxLimit) * 100).toFixed(2);
    }

    // Date-wise document count
    const dateWiseDocs = await Document.findAll({
      where: {
        UserId: req.userId,
      },
      attributes: [
        [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
      order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
    });

    // Generate recent activity logs
    let recentActivities = [];
    const recentDocuments = await Document.findAll({
      where: {
        UserId: req.userId,
      },
      order: [["createdAt", "DESC"]],
      limit: 1,
    });

    recentDocuments.forEach((doc) => {
      recentActivities.push({
        description: `New ${doc.type.toLowerCase()} uploaded`,
        timestamp: doc.createdAt,
      });

      if (doc.status === "Processed" || doc.status === "Ready") {
        recentActivities.push({
          description: `${doc.type} #${doc.id} processed`,
          timestamp: doc.updatedAt,
        });
      } else if (doc.status === "Error") {
        recentActivities.push({
          description: `Processing error on #${doc.id}`,
          timestamp: doc.updatedAt,
        });
      }
    });

    return res.status(200).json({
      // userStats: {
      //   totalDocuments: totalUserDocuments,
      //   completedDocuments: completedUserDocuments,
      //   pendingDocuments: pendingUserDocuments,
      //   successRate: userSuccessRate,
      // },
      companyStats: {
        totalDocuments: totalCompanyDocuments,
        completedDocuments: completedCompanyDocuments,
        pendingDocuments: pendingCompanyDocuments,
        successRate: companySuccessRate,
        totalUsers: totalCompanyUsers,
      },
      planUsage: {
        invoiceUsage,
        receiptUsage,
        totalDocsUsage,
      },
      dateWiseDocs,
      recentActivities, // Add date-wise document count to the response
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//The API call to handle first quickBook api call and the OPENAI function
router.post("/ai-chat", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { prompt, companyId } = req.body;

    //console.log("company id --->>", companyId);
    if (!prompt) {
      return res.status(400).send("Prompt is required.");
    }
    const company = await Company.findOne({
      where: { UserId: userId, id: companyId },
      include: [
        {
          model: Integration,
          required: false,
        },
      ],
    });

    if (!company) {
      console.log(
        `Company not found for user ${userId} and company ${companyId}`,
      );
      return res.status(404).send("Company not found or access denied.");
    }

    // Get QuickBooks integration
    const integration = company.Integrations.find(
      (i) => i.service_type.toLowerCase() === "quickbooks",
    );
    //console.log("company integrations ===>>>", integration);

    if (!integration) {
      console.log(`QuickBooks integration not found for company ${company.id}`);
      return res
        .status(404)
        .send("QuickBooks integration not found for this company.");
    }

    const createChatHistory = await ChatHistory.create({
      UserId: userId,
      prompt: prompt,
    });

    const aiService = new AI();
    const { realmId, access_token, refresh_token } = integration.credentials;
    let accessToken = access_token;
    let refreshToken = refresh_token;

    //console.log({"realmid --->>>": realmId,"access_token --->>>": access_token,"refresh_token --->>>": refresh_token });

    // Call getAIPromptAnswer with the updated parameters
    const aiResponse = await aiService.getAIPromptAnswer(
      prompt,
      realmId,
      accessToken,
      refreshToken,
    );
    console.log("aiResponse --->>> at the api route --->>>", aiResponse);
    if (!aiResponse) {
      return res.status(500).send("Failed to get AI response.");
    }

    // Check if the response is an error object
    if (aiResponse.error) {
      return res.status(500).json({
        message: "Error in AI processing",
        error: aiResponse.error,
      });
    }
    //console.log({"checking all the datas before storing in the ChatHistory --->>>": userId, prompt,aiResponse})

    const updateChatHistory = await ChatHistory.update(
      {
        result: aiResponse,
      },
      {
        where: {
          id: createChatHistory.id,
        },
      },
    );

    if (!createChatHistory || !updateChatHistory) {
      console.log("Failed to store the chat in the ChatHistory");
      res
        .status(400)
        .json({ message: "Failed to store the chat in ChatHistory" });
    }

    res.status(200).json({
      message: "AI processing completed successfully",
      response: aiResponse,
    });
  } catch (error) {
    console.error("Error processing AI prompt:", error);
    res.status(500).send("An error occurred while processing the AI prompt.");
  }
});

router.get("/chat-history-preview", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const offset = (page - 1) * limit;

    const findUser = await User.findOne({
      where: {
        id: userId,
      },
    });

    if (!findUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const { count, rows: findChatHistoryPreviews } =
      await ChatHistory.findAndCountAll({
        where: {
          UserId: userId,
          result: {
            [Op.ne]: null,
          },
        },
        order: [["createdAt", "DESC"]],
        attributes: ["id", "prompt"],
        limit: limit,
        offset: offset,
      });

    const totalPages = Math.ceil(count / limit);
    const hasMore = page < totalPages;

    res.status(200).json({
      data: findChatHistoryPreviews,
      hasMore: hasMore,
      totalPages: totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error getting chat previews --->>", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/chat-data/:chatId/", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const chatId = req.params.chatId;
    if (!userId || !chatId) {
      return res.status(401).json({ message: "Invalid data" });
    }
    const findUser = await User.findOne({
      where: {
        id: userId,
      },
    });
    if (!findUser) {
      return res.status(401).json({ meesage: "User not found" });
    }
    const findChat = await ChatHistory.findOne({
      where: {
        id: chatId,
        userId: userId,
      },
      attributes: ["id", "prompt", "result"],
    });
    //console.log("chat data--->>>", findChat)
    if (!findChat) {
      return res.status(404).json({ message: "Chat History not found" });
    }
    res.status(200).json({ data: findChat });
  } catch (error) {
    console.error("Error getting chat data --->>", error);
    res.status(500).json({ success: false, meesage: "Internal server error" });
  }
});
router.post(
  "/delete-quickbooks-integration/:companyId",
  authenticateToken,
  async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'https://app.kounto.ai');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    const UserId = req.userId;
    const companyId = req.params.companyId;
    if (!UserId || !companyId) {
      console.log("Missing token or companyId");
      return res.status(400).json({ message: "Missing token or companyId." });
    }
    const findUser = await User.findOne({
      where: {
        id: UserId,
      },
    });
    if (!findUser) {
      console.log("User not found for userId --->>>", UserId);
      return res.status(401).json({ message: "User not found." });
    }

    const integration = await Integration.findOne({
      where: {
        CompanyId: companyId,
        UserId: UserId,
      },
    });

    if (!integration) {
      return res.status(401).json({
        message: "Integration not found."
      })
    }

    const realmId = integration?.credentials?.realmId;

    const deleteInegrations = await Integration.destroy({
      where: {
        CompanyId: companyId,
        UserId: UserId,
      },
    });
    if (!deleteInegrations) {
      console.log(
        "Failed to delete the integrations of the user and the comopany with quickbooks.",
      );
      return res
        .status(400)
        .json({ message: "Failed to disconnect the quickbooks integrations." });
    }
    return res.redirect(`https://app.kounto.ai/quickbooks-disconnected?realmId=${realmId}`);
  },
);

module.exports = router;
