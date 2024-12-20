const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { sequelize } = require("./src/db/models");

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Enable CORS
app.use(cors());

// Enable JSON use
app.use(express.json());

// Server is Live
app.get("/", (req, res) => {
  return res.status(200).json({ message: "Server is live" });
});

// Routes
app.use("/api/", require("./src/routes/index"));

// Setup error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

async function initializeServer() {
  try {
    // Sync all models with the database
    await sequelize.sync({ alter: false });
    console.log("Database synchronized successfully");

    // Start server
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Unable to sync database:", error);
    process.exit(1);
  }
}

// Initialize the server
initializeServer();

module.exports = app;
