const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { sequelize } = require("./src/db/models");
const timeout = require("connect-timeout");

dotenv.config();

const app = express();

app.use(cors());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(timeout("600s"));

app.use(express.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
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
    route: req.originalUrl,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

async function initializeServer() {
  try {
    await Promise.race([
      sequelize.sync({ alter: false }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database sync timeout")), 300000),
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
