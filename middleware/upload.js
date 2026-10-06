const multer = require("multer");


// =====================================================
// MEMORY STORAGE
// =====================================================

const storage =
  multer.memoryStorage();


// =====================================================
// ALLOWED TYPES
// =====================================================

const allowedTypes = [

  "image/jpeg",

  "image/jpg",

  "image/png",

  "image/webp",

  "image/avif",

];


// =====================================================
// FILE FILTER
// =====================================================

const fileFilter = (
  req,
  file,
  cb
) => {

  if (
    !allowedTypes.includes(
      file.mimetype
    )
  ) {

    return cb(
      new Error(
        "Only JPG, JPEG, PNG, WEBP and AVIF images are allowed"
      )
    );
  }


  cb(null, true);
};


// =====================================================
// MULTER
// =====================================================

const upload =
  multer({

    storage,

    limits: {

      fileSize:
        500 * 1024 * 1024,

      files: 30,

    },

    fileFilter,

  });


module.exports = upload;