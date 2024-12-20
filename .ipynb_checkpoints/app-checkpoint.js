const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Enable CORS
app.use(cors());

// Enable JSON use
app.use(express.json());

app.use("/api/vendors/", require("./src/routes/vendors"));
app.use("/api/customers/", require("./src/routes/customers"));
app.use("/api/accounts/", require("./src/routes/accounts"));
app.use("/api/invoices/", require("./src/routes/invoices"));

app.use("/api/files/", require("./src/routes/files"));

// Setup error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

module.exports = app;
