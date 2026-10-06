const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const clientRoutes = require("./routes/clientRoutes");
const businessRoutes = require("./routes/businessRoutes");
const leadRoutes = require("./routes/leadRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const projectRoutes = require("./routes/projectRoutes");
const eventRoutes = require("./routes/eventRoutes");
const authenticate = require("./middleware/authenticate");
const invoiceRoutes = require("./routes/invoiceRoutes");
const eventGalleryRoutes = require("./routes/eventGalleryRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = [
  "http://localhost:5173", // Vite dev server
  "https://kithandkin.netlify.app", // in case you also run CRA/other tooling
   "https://kithandkinweddings.in", // 👈 add your production frontend URL here
];

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Public
app.use("/api/auth", authRoutes);

// Protected — requires a valid Bearer token from /api/auth/login
app.use("/api/users", authenticate, userRoutes);
app.use("/api/clients", authenticate, clientRoutes);
app.use("/api/businesses", authenticate, businessRoutes);
app.use("/api/leads", authenticate, leadRoutes);
app.use("/api/services", authenticate, serviceRoutes);
app.use("/api/projects", authenticate, projectRoutes);
app.use("/api/events", authenticate, eventRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use(
  "/api/event-gallery",
  eventGalleryRoutes
);
app.use(notFound);
app.use(errorHandler);

module.exports = app;