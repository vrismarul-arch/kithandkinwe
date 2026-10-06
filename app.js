const express = require("express");
const cors = require("cors");

// =======================================
// ROUTES
// =======================================
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const clientRoutes = require("./routes/clientRoutes");
const businessRoutes = require("./routes/businessRoutes");
const leadRoutes = require("./routes/leadRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const projectRoutes = require("./routes/projectRoutes");
const eventRoutes = require("./routes/eventRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const eventGalleryRoutes = require("./routes/eventGalleryRoutes");

// =======================================
// MIDDLEWARE
// =======================================
const authenticate = require("./middleware/authenticate");
const {
  notFound,
  errorHandler,
} = require("./middleware/errorHandler");

const app = express();

// =======================================
// CORS
// =======================================
const allowedOrigins = [
  // Local development
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // Production frontend
  "https://kithandkin.netlify.app",
  "https://kithandkinweddings.in",
  "https://www.kithandkinweddings.in",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman, curl and server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked:", origin);

    return callback(
      new Error(`Origin ${origin} not allowed by CORS`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

// =======================================
// BODY PARSER
// =======================================
app.use(express.json({ limit: "50mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

// =======================================
// REQUEST LOGGER
// =======================================
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
  );

  next();
});

// =======================================
// ROOT TEST ROUTE
// =======================================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Kith & Kin Weddings Backend is running",
    status: "online",
    environment: process.env.NODE_ENV || "production",
    port: process.env.PORT || 2000,
    timestamp: new Date().toISOString(),
  });
});

// =======================================
// API TEST ROUTE
// =======================================
app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Test API working successfully",
    timestamp: new Date().toISOString(),
  });
});

// =======================================
// HEALTH CHECK
// =======================================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "Backend and API are running",
    timestamp: new Date().toISOString(),
  });
});

// =======================================
// PUBLIC AUTH ROUTES
// =======================================
app.use("/api/auth", authRoutes);

// =======================================
// PROTECTED USER ROUTES
// =======================================
app.use(
  "/api/users",
  authenticate,
  userRoutes
);

// =======================================
// PROTECTED CLIENT ROUTES
// =======================================
app.use(
  "/api/clients",
  authenticate,
  clientRoutes
);

// =======================================
// PROTECTED BUSINESS ROUTES
// =======================================
app.use(
  "/api/businesses",
  authenticate,
  businessRoutes
);

// =======================================
// PROTECTED LEAD ROUTES
// =======================================
app.use(
  "/api/leads",
  authenticate,
  leadRoutes
);

// =======================================
// PROTECTED SERVICE ROUTES
// =======================================
app.use(
  "/api/services",
  authenticate,
  serviceRoutes
);

// =======================================
// PROTECTED PROJECT ROUTES
// =======================================
app.use(
  "/api/projects",
  authenticate,
  projectRoutes
);

// =======================================
// PROTECTED EVENT ROUTES
// =======================================
app.use(
  "/api/events",
  authenticate,
  eventRoutes
);

// =======================================
// INVOICE ROUTES
// =======================================
app.use(
  "/api/invoices",
  invoiceRoutes
);

// =======================================
// EVENT GALLERY ROUTES
// =======================================
app.use(
  "/api/event-gallery",
  eventGalleryRoutes
);

// =======================================
// 404 - ROUTE NOT FOUND
// =======================================
app.use(notFound);

// =======================================
// GLOBAL ERROR HANDLER
// =======================================
app.use(errorHandler);

// =======================================
// EXPORT APP
// =======================================
module.exports = app;