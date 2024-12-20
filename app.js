const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { sequelize } = require("./src/db/models");
const timeout = require("connect-timeout");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(timeout("300s"));

app.use(express.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 50000,
  }),
);

app.get("/", (req, res) => {
  return res.status(200).json({ message: "Server is live" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.use("/api/", require("./src/routes/index"));

app.use((err, req, res, next) => {
  console.error("Error details:", {
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status,
  });

  if (err.code === "ETIMEDOUT" || err.message.includes("timeout")) {
    return res.status(408).json({
      error: "Request timeout",
      message: "The request took too long to process. Please try again.",
    });
  }

  if (err instanceof SyntaxError && err.status === 413) {
    return res.status(413).json({
      error: "Payload too large",
      message: "The uploaded file is too large. Maximum size is 50MB.",
    });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

async function initializeServer() {
  try {
    await Promise.race([
      sequelize.sync({ alter: false }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database sync timeout")), 30000),
      ),
    ]);

    console.log("Database synchronized successfully");

    const port = process.env.PORT || 4000;
    const server = app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

    server.timeout = 300000;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    server.on("error", (error) => {
      console.error("Server error:", error);
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Server initialization error:", error);
    process.exit(1);
  }
}

initializeServer();

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  process.exit(1);
});

module.exports = app;
