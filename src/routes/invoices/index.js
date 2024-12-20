const express = require("express");
const router = express.Router();
const { upload, downloadFileAsBuffer } = require("./../../services/storage");
const {
  Invoice,
  InvoiceSaleLineItem,
  SaleLineItem,
  Customer,
} = require("../../db/models");
// const { processInvoice } = require("../../services/processfiles");

// Route to upload a file
router.post("/upload", upload.single("file"), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  // Return the file URL

  const invoice = await Invoice.create({
    CompanyId: 1,
    IntegrationId: 1,
    SourceURL: req.file.location,
  });

  // processInvoice(invoice.dataValues);

  res.send({
    message: "File uploaded successfully",
    url: req.file.location,
    invoice: invoice,
  });
});

// Create Invoice
router.post("/", async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    res.status(201).send(invoice);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Get All Invoices with Pagination, Line Items, and Customer
router.get("/", async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  try {
    const invoices = await Invoice.findAndCountAll({
      include: [
        {
          model: SaleLineItem,
          as: "SaleLineItems",
          through: { attributes: [] }, // Hide through table attributes
        },
        {
          model: Customer,
        },
      ],
      limit,
      offset: (page - 1) * limit,
      distinct: true, // for correct count
    });
    res.send({
      totalPages: Math.ceil(invoices.count / limit),
      currentPage: parseInt(page),
      totalItems: invoices.count,
      items: invoices.rows,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Get Single Invoice by ID with Line Items and Customer
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: SaleLineItem,
          as: "SaleLineItems",
          through: { attributes: [] },
        },
        {
          model: Customer,
        },
      ],
    });
    if (invoice) {
      res.send(invoice);
    } else {
      res.status(404).send("Invoice not found");
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Update Invoice
router.put("/:id", async (req, res) => {
  console.log(req.params.id, req.body);
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (invoice) {
      await invoice.update(req.body);
      res.send(invoice);
    } else {
      res.status(404).send("Invoice not found");
    }
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
});

// Delete Invoice
router.delete("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (invoice) {
      await invoice.destroy();
      res.send("Invoice deleted");
    } else {
      res.status(404).send("Invoice not found");
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
