const express = require("express");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
/* sasa */
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

module.exports = router;