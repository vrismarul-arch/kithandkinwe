const {
  createClient,
} = require("@supabase/supabase-js");

const WebSocket = require("ws");

const env = require("../config/env");


const BUCKET_NAME =
  "event-gallery";


const supabase =
  createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      realtime: {
        transport: WebSocket,
      },
    }
  );


// =====================================================
// UPLOAD
// =====================================================

const uploadToSupabase = async (
  file,
  folder = "events"
) => {

  if (!file) {
    throw new Error(
      "File is required"
    );
  }


  if (!file.buffer) {
    throw new Error(
      "File buffer is missing"
    );
  }


  const extension =
    file.originalname
      ?.split(".")
      .pop()
      ?.toLowerCase() || "jpg";


  const randomString =
    Math.random()
      .toString(36)
      .substring(2, 12);


  const fileName =
    `${Date.now()}-${randomString}.${extension}`;


  const storagePath =
    `${folder}/${fileName}`;


  console.log(
    "SUPABASE UPLOAD START"
  );

  console.log(
    "Bucket:",
    BUCKET_NAME
  );

  console.log(
    "Original Name:",
    file.originalname
  );

  console.log(
    "Mime Type:",
    file.mimetype
  );

  console.log(
    "File Size:",
    file.size
  );

  console.log(
    "Buffer Exists:",
    !!file.buffer
  );

  console.log(
    "Buffer Length:",
    file.buffer.length
  );

  console.log(
    "Storage Path:",
    storagePath
  );


  // ===================================================
  // UPLOAD
  // ===================================================

  const {
    data,
    error,
  } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(
      storagePath,
      file.buffer,
      {
        contentType:
          file.mimetype,

        upsert: false,

        cacheControl:
          "3600",
      }
    );


  if (error) {

    console.error(
      "Supabase upload error:",
      error
    );

    throw error;
  }


  console.log(
    "Supabase Upload Success:",
    data
  );


  // ===================================================
  // PUBLIC URL
  // ===================================================

  const {
    data: publicData,
  } =
    supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(
        storagePath
      );


  const publicUrl =
    publicData?.publicUrl;


  console.log(
    "Public URL:",
    publicUrl
  );


  if (!publicUrl) {
    throw new Error(
      "Failed to generate Supabase public URL"
    );
  }


  // ===================================================
  // RETURN
  // ===================================================

  return {

    path:
      data?.path || storagePath,

    id:
      data?.id || null,

    fullPath:
      data?.fullPath ||
      `${BUCKET_NAME}/${storagePath}`,

    storagePath,

    publicUrl,

  };
};


// =====================================================
// DELETE
// =====================================================

const deleteFromSupabase = async (
  storagePath
) => {

  if (!storagePath) {
    return;
  }


  const {
    data,
    error,
  } =
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([
        storagePath,
      ]);


  if (error) {

    console.error(
      "Supabase delete error:",
      error
    );

    throw error;
  }


  return data;
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  uploadToSupabase,

  deleteFromSupabase,

};