const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const adminOnly = require("../middleware/adminOnly");
const upload = require("../middleware/upload");

const {
  getAllGalleryEvents,
  createEvent,
  updateEvent,
  getEventGallery,
  uploadImages,
  deleteGalleryImage,
  updateSortOrder,
  setPrimary,
  deleteEvent,
} = require("../controllers/eventGalleryController");


// =====================================================
// PUBLIC - GET ALL EVENTS
// GET /api/event-gallery
// =====================================================

router.get(
  "/",
  getAllGalleryEvents
);


// =====================================================
// PUBLIC - GET EVENT GALLERY
// GET /api/event-gallery/event/:eventId
// =====================================================

router.get(
  "/event/:eventId",
  getEventGallery
);


// =====================================================
// ADMIN - CREATE EVENT
// POST /api/event-gallery
// =====================================================

router.post(
  "/",
  authenticate,
  adminOnly,
  createEvent
);


// =====================================================
// ADMIN - UPDATE EVENT
// PUT /api/event-gallery/:eventId
// =====================================================

router.put(
  "/:eventId",
  authenticate,
  adminOnly,
  updateEvent
);


// =====================================================
// ADMIN - UPLOAD IMAGES
// POST /api/event-gallery/event/:eventId/upload
// =====================================================

router.post(
  "/event/:eventId/upload",
  authenticate,
  adminOnly,
  upload.array("files", 30),
  uploadImages
);


// =====================================================
// ADMIN - DELETE COMPLETE EVENT
// DELETE /api/event-gallery/event/:eventId
// =====================================================

router.delete(
  "/event/:eventId",
  authenticate,
  adminOnly,
  deleteEvent
);


// =====================================================
// ADMIN - DELETE SINGLE IMAGE
// DELETE /api/event-gallery/:id
// =====================================================

router.delete(
  "/:id",
  authenticate,
  adminOnly,
  deleteGalleryImage
);


// =====================================================
// ADMIN - UPDATE IMAGE ORDER
// PATCH /api/event-gallery/:id/order
// =====================================================

router.patch(
  "/:id/order",
  authenticate,
  adminOnly,
  updateSortOrder
);


// =====================================================
// ADMIN - SET PRIMARY IMAGE
// PATCH /api/event-gallery/:id/primary
// =====================================================

router.patch(
  "/:id/primary",
  authenticate,
  adminOnly,
  setPrimary
);


module.exports = router;