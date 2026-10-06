const eventGalleryModel = require("../models/eventGalleryModel");

const supabaseStorage = require("../utils/supabaseStorage");

const uploadToSupabase =
  supabaseStorage.uploadToSupabase;

const deleteFromSupabase =
  supabaseStorage.deleteFromSupabase;


// =====================================================
// GET ALL EVENTS
// =====================================================

const getAllGalleryEvents = async (req, res) => {
  try {

    const events =
      await eventGalleryModel.getAllEventsWithGallery();

    return res.status(200).json({
      success: true,
      data: events,
    });

  } catch (error) {

    console.error(
      "Get all gallery events error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to get gallery events",
    });
  }
};


// =====================================================
// CREATE EVENT
// =====================================================

const createEvent = async (req, res) => {
  try {

    const {
      title,
      slug,
      eventDate,
    } = req.body;


    // -----------------------------
    // VALIDATION
    // -----------------------------

    if (
      !title ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Event title is required",
      });
    }


    if (
      !slug ||
      !slug.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Event slug is required",
      });
    }


    if (!eventDate) {
      return res.status(400).json({
        success: false,
        message: "Event date is required",
      });
    }


    // -----------------------------
    // CREATE
    // -----------------------------

    const event =
      await eventGalleryModel.createEvent({
        title: title.trim(),
        slug: slug.trim(),
        eventDate,
      });


    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event,
    });

  } catch (error) {

    console.error(
      "Create event error:",
      error
    );


    // Duplicate slug
    if (
      error.code === "ER_DUP_ENTRY" ||
      error.code === 1062 ||
      error.message
        ?.toLowerCase()
        .includes("duplicate")
    ) {

      return res.status(409).json({
        success: false,
        message:
          "An event with this slug already exists",
      });
    }


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create event",
    });
  }
};


// =====================================================
// UPDATE EVENT
// =====================================================

const updateEvent = async (req, res) => {
  try {

    const { eventId } =
      req.params;


    const {
      title,
      slug,
      eventDate,
    } = req.body;


    // -----------------------------
    // VALIDATE EVENT ID
    // -----------------------------

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }


    // -----------------------------
    // VALIDATE TITLE
    // -----------------------------

    if (
      !title ||
      !title.trim()
    ) {

      return res.status(400).json({
        success: false,
        message: "Event title is required",
      });
    }


    // -----------------------------
    // VALIDATE SLUG
    // -----------------------------

    if (
      !slug ||
      !slug.trim()
    ) {

      return res.status(400).json({
        success: false,
        message: "Event slug is required",
      });
    }


    // -----------------------------
    // VALIDATE DATE
    // -----------------------------

    if (!eventDate) {

      return res.status(400).json({
        success: false,
        message: "Event date is required",
      });
    }


    // -----------------------------
    // CHECK EVENT
    // -----------------------------

    const existingEvent =
      await eventGalleryModel.getEventById(
        eventId
      );


    if (!existingEvent) {

      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }


    // -----------------------------
    // UPDATE
    // -----------------------------

    const event =
      await eventGalleryModel.updateEvent(
        eventId,
        {
          title: title.trim(),
          slug: slug.trim(),
          eventDate,
        }
      );


    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event,
    });

  } catch (error) {

    console.error(
      "Update event error:",
      error
    );


    // Duplicate slug
    if (
      error.code === "ER_DUP_ENTRY" ||
      error.code === 1062 ||
      error.message
        ?.toLowerCase()
        .includes("duplicate")
    ) {

      return res.status(409).json({
        success: false,
        message:
          "An event with this slug already exists",
      });
    }


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update event",
    });
  }
};


// =====================================================
// GET SINGLE EVENT GALLERY
// =====================================================

const getEventGallery = async (req, res) => {
  try {

    const { eventId } =
      req.params;


    if (!eventId) {

      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }


    // -----------------------------
    // GET EVENT
    // -----------------------------

    const event =
      await eventGalleryModel.getEventById(
        eventId
      );


    if (!event) {

      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }


    // -----------------------------
    // GET IMAGES
    // -----------------------------

    const images =
      await eventGalleryModel.getByEvent(
        eventId
      );


    // -----------------------------
    // SEPARATE IMAGES
    // -----------------------------

    const thumbnail =
      images.find(
        (image) =>
          image.image_type === "thumbnail"
      ) || null;


    const hero =
      images.filter(
        (image) =>
          image.image_type === "hero"
      );


    const gallery =
      images.filter(
        (image) =>
          image.image_type === "gallery"
      );


    return res.status(200).json({

      success: true,

      event,

      data: {
        thumbnail,
        hero,
        gallery,
      },

      images,

    });

  } catch (error) {

    console.error(
      "Get event gallery error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to get event gallery",
    });
  }
};


// =====================================================
// UPLOAD IMAGES
// =====================================================

const uploadImages = async (req, res) => {
  try {

    const { eventId } =
      req.params;


    const {
      imageType,
      altText,
    } = req.body;


    console.log(
      "===================================="
    );

    console.log(
      "EVENT GALLERY UPLOAD"
    );

    console.log(
      "Event ID:",
      eventId
    );

    console.log(
      "Image Type:",
      imageType
    );

    console.log(
      "Files:",
      req.files?.length || 0
    );

    console.log(
      "===================================="
    );


    // -----------------------------
    // VALIDATE EVENT ID
    // -----------------------------

    if (!eventId) {

      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }


    // -----------------------------
    // VALIDATE IMAGE TYPE
    // -----------------------------

    const allowedTypes = [
      "thumbnail",
      "hero",
      "gallery",
    ];


    if (
      !allowedTypes.includes(
        imageType
      )
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid image type. Allowed types: thumbnail, hero, gallery",
      });
    }


    // -----------------------------
    // VALIDATE FILES
    // -----------------------------

    if (
      !req.files ||
      req.files.length === 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Please select at least one image",
      });
    }


    // -----------------------------
    // CHECK EVENT
    // -----------------------------

    const event =
      await eventGalleryModel.getEventById(
        eventId
      );


    if (!event) {

      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }


    // =================================================
    // THUMBNAIL
    // ONLY ONE THUMBNAIL
    // =================================================

    if (
      imageType === "thumbnail"
    ) {

      const oldThumbnail =
        await eventGalleryModel.getThumbnail(
          eventId
        );


      if (oldThumbnail) {

        // ---------------------------
        // DELETE OLD SUPABASE FILE
        // ---------------------------

        if (
          oldThumbnail.storage_path &&
          typeof deleteFromSupabase ===
            "function"
        ) {

          try {

            await deleteFromSupabase(
              oldThumbnail.storage_path
            );

          } catch (storageError) {

            console.error(
              "Failed to delete old thumbnail from Supabase:",
              storageError
            );

          }
        }


        // ---------------------------
        // DELETE OLD DB RECORD
        // ---------------------------

        await eventGalleryModel.deleteThumbnail(
          eventId
        );
      }
    }


    // =================================================
    // SORT ORDER
    // =================================================

    let sortOrder = 0;


    if (
      imageType !== "thumbnail"
    ) {

      const existingImages =
        await eventGalleryModel.getByEvent(
          eventId
        );


      const sameType =
        existingImages.filter(
          (image) =>
            image.image_type ===
            imageType
        );


      if (
        sameType.length > 0
      ) {

        sortOrder =
          Math.max(
            ...sameType.map(
              (image) =>
                Number(
                  image.sort_order
                ) || 0
            )
          ) + 1;
      }
    }


    // =================================================
    // RESULTS
    // =================================================

    const uploaded = [];

    const failed = [];


    // =================================================
    // UPLOAD LOOP
    // =================================================

    for (
      let index = 0;
      index < req.files.length;
      index++
    ) {

      const file =
        req.files[index];


      try {

        console.log(
          "Uploading:",
          file.originalname
        );


        // -----------------------------
        // STORAGE FOLDER
        // -----------------------------

        const folder =
          `events/${eventId}/${imageType}`;


        // -----------------------------
        // SUPABASE UPLOAD
        // -----------------------------

        const uploadResult =
          await uploadToSupabase(
            file,
            folder
          );


        console.log(
          "Supabase upload result:",
          uploadResult
        );


        // -----------------------------
        // CHECK PUBLIC URL
        // -----------------------------

        if (
          !uploadResult?.publicUrl
        ) {

          throw new Error(
            "Supabase upload completed but public URL is missing"
          );
        }


        // -----------------------------
        // CHECK STORAGE PATH
        // -----------------------------

        if (
          !uploadResult?.storagePath
        ) {

          throw new Error(
            "Supabase upload completed but storage path is missing"
          );
        }


        // -----------------------------
        // SAVE TO DATABASE
        // -----------------------------

        const image =
          await eventGalleryModel.createImage({

            eventId,

            imageType,

            imageUrl:
              uploadResult.publicUrl,

            storagePath:
              uploadResult.storagePath,

            fileName:
              file.originalname,

            mimeType:
              file.mimetype,

            fileSize:
              file.size,

            altText:
              altText ||
              file.originalname ||
              event.title,

            sortOrder:
              imageType ===
              "thumbnail"
                ? 0
                : sortOrder,

            isPrimary:
              imageType ===
              "thumbnail"
                ? true
                : false,

          });


        uploaded.push(
          image
        );


        sortOrder++;


        console.log(
          "Database image created:",
          image.id
        );

      } catch (fileError) {

        console.error(
          `Upload failed for ${file.originalname}:`,
          fileError
        );


        failed.push({

          fileName:
            file.originalname,

          message:
            fileError.message ||
            "Upload failed",

        });
      }
    }


    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({

      success:
        uploaded.length > 0,

      message:
        uploaded.length > 0
          ? `${uploaded.length} image(s) uploaded successfully`
          : "No images were uploaded successfully",

      uploaded,

      failed,

      total:
        req.files.length,

      successCount:
        uploaded.length,

      failedCount:
        failed.length,

    });

  } catch (error) {

    console.error(
      "Upload images error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to upload images",
    });
  }
};


// =====================================================
// DELETE SINGLE IMAGE
// =====================================================

const deleteGalleryImage = async (
  req,
  res
) => {

  try {

    const { id } =
      req.params;


    if (!id) {

      return res.status(400).json({
        success: false,
        message: "Image ID is required",
      });
    }


    // -----------------------------
    // GET IMAGE
    // -----------------------------

    const image =
      await eventGalleryModel.getById(
        id
      );


    if (!image) {

      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }


    // -----------------------------
    // DELETE STORAGE
    // -----------------------------

    if (
      image.storage_path &&
      typeof deleteFromSupabase ===
        "function"
    ) {

      try {

        await deleteFromSupabase(
          image.storage_path
        );

      } catch (storageError) {

        console.error(
          "Supabase delete error:",
          storageError
        );

      }
    }


    // -----------------------------
    // DELETE DB
    // -----------------------------

    await eventGalleryModel.deleteImage(
      id
    );


    return res.status(200).json({
      success: true,
      message:
        "Image deleted successfully",
    });

  } catch (error) {

    console.error(
      "Delete gallery image error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete image",
    });
  }
};


// =====================================================
// UPDATE SORT ORDER
// =====================================================

const updateSortOrder = async (
  req,
  res
) => {

  try {

    const { id } =
      req.params;


    const {
      sortOrder,
    } = req.body;


    if (!id) {

      return res.status(400).json({
        success: false,
        message:
          "Image ID is required",
      });
    }


    if (
      sortOrder === undefined ||
      sortOrder === null
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Sort order is required",
      });
    }


    const image =
      await eventGalleryModel.updateSortOrder(
        id,
        Number(sortOrder)
      );


    return res.status(200).json({

      success: true,

      message:
        "Image order updated successfully",

      data: image,

    });

  } catch (error) {

    console.error(
      "Update sort order error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update image order",
    });
  }
};


// =====================================================
// SET PRIMARY IMAGE
// =====================================================

const setPrimary = async (
  req,
  res
) => {

  try {

    const { id } =
      req.params;


    const {
      eventId,
    } = req.body;


    if (!id) {

      return res.status(400).json({
        success: false,
        message:
          "Image ID is required",
      });
    }


    if (!eventId) {

      return res.status(400).json({
        success: false,
        message:
          "Event ID is required",
      });
    }


    const image =
      await eventGalleryModel.setPrimary(
        id,
        eventId
      );


    return res.status(200).json({

      success: true,

      message:
        "Primary image updated successfully",

      data: image,

    });

  } catch (error) {

    console.error(
      "Set primary error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to set primary image",
    });
  }
};


// =====================================================
// DELETE COMPLETE EVENT
// =====================================================

const deleteEvent = async (
  req,
  res
) => {

  try {

    const { eventId } =
      req.params;


    if (!eventId) {

      return res.status(400).json({
        success: false,
        message:
          "Event ID is required",
      });
    }


    // -----------------------------
    // CHECK EVENT
    // -----------------------------

    const event =
      await eventGalleryModel.getEventById(
        eventId
      );


    if (!event) {

      return res.status(404).json({
        success: false,
        message:
          "Event not found",
      });
    }


    // -----------------------------
    // GET IMAGES
    // -----------------------------

    const images =
      await eventGalleryModel.getByEvent(
        eventId
      );


    // -----------------------------
    // DELETE SUPABASE FILES
    // -----------------------------

    if (
      typeof deleteFromSupabase ===
      "function"
    ) {

      for (
        const image of images
      ) {

        if (
          !image.storage_path
        ) {
          continue;
        }


        try {

          await deleteFromSupabase(
            image.storage_path
          );

        } catch (storageError) {

          console.error(
            "Failed to delete storage file:",
            storageError
          );

        }
      }
    }


    // -----------------------------
    // DELETE DATABASE DATA
    // -----------------------------

    await eventGalleryModel.deleteEvent(
      eventId
    );


    return res.status(200).json({

      success: true,

      message:
        "Event deleted successfully",

    });

  } catch (error) {

    console.error(
      "Delete event error:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete event",
    });
  }
};


// =====================================================
// EXPORT ALL CONTROLLERS
// =====================================================

module.exports = {

  getAllGalleryEvents,

  createEvent,

  updateEvent,

  getEventGallery,

  uploadImages,

  deleteGalleryImage,

  updateSortOrder,

  setPrimary,

  deleteEvent,

};