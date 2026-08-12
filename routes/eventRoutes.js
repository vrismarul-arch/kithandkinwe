const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");

router.get("/", eventController.getAll);
router.get("/:id", eventController.getById);
router.post("/", eventController.create);
router.put("/:id", eventController.update);
router.delete("/:id", eventController.remove);

module.exports = router;

/*
  Mount this in your main app/router file the same way projects/services/
  users are mounted, e.g.:

    const eventRoutes = require("./routes/eventRoutes");
    app.use("/api/events", eventRoutes);
*/