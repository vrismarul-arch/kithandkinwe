const pool = require("../config/db");


// =====================================================
// GET EVENT BY ID
// =====================================================

const getEventById = async (eventId) => {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        slug,
        eventDate,
        startTime,
        endTime,
        description,
        location,
        color,
        repeatType,
        reminder,
        reminderMinutes,
        attendees,
        createdAt,
        updatedAt
      FROM events
      WHERE id = ?
      LIMIT 1
    `,
    [eventId]
  );

  return rows[0] || null;
};


// =====================================================
// CREATE EVENT
// =====================================================

const createEvent = async ({
  title,
  slug,
  eventDate,
}) => {
  if (!title || !title.trim()) {
    throw new Error("Event title is required");
  }

  if (!eventDate) {
    throw new Error("Event date is required");
  }

  const [result] = await pool.query(
    `
      INSERT INTO events
      (
        title,
        slug,
        eventDate
      )
      VALUES (?, ?, ?)
    `,
    [
      title.trim(),
      slug ? slug.trim() : null,
      eventDate,
    ]
  );

  return getEventById(result.insertId);
};


// =====================================================
// UPDATE EVENT
// =====================================================

const updateEvent = async (
  eventId,
  {
    title,
    slug,
    eventDate,
  }
) => {
  if (!eventId) {
    throw new Error("Event ID is required");
  }

  if (!title || !title.trim()) {
    throw new Error("Event title is required");
  }

  if (!eventDate) {
    throw new Error("Event date is required");
  }

  await pool.query(
    `
      UPDATE events
      SET
        title = ?,
        slug = ?,
        eventDate = ?
      WHERE id = ?
    `,
    [
      title.trim(),
      slug ? slug.trim() : null,
      eventDate,
      eventId,
    ]
  );

  return getEventById(eventId);
};


// =====================================================
// GET ALL EVENTS WITH THUMBNAIL
// =====================================================

const getAllEventsWithGallery = async () => {
  const [rows] = await pool.query(
    `
      SELECT
        e.id,
        e.title,
        e.slug,
        e.eventDate,
        e.startTime,
        e.endTime,
        e.description,
        e.location,
        e.color,
        e.repeatType,
        e.reminder,
        e.reminderMinutes,
        e.attendees,
        e.createdAt,
        e.updatedAt,

        eg.id AS gallery_id,
        eg.image_url,
        eg.image_type,
        eg.storage_path,
        eg.file_name,
        eg.mime_type,
        eg.file_size,
        eg.alt_text,
        eg.sort_order,
        eg.is_primary,
        eg.created_at AS gallery_created_at,
        eg.updated_at AS gallery_updated_at

      FROM events e

      INNER JOIN event_gallery eg
        ON eg.event_id = e.id

      WHERE eg.image_type = 'thumbnail'

      ORDER BY e.id DESC
    `
  );

  return rows;
};


// =====================================================
// GET ALL GALLERY IMAGES FOR EVENT
// =====================================================

const getByEvent = async (eventId) => {
  const [rows] = await pool.query(
    `
      SELECT
        eg.id,
        eg.event_id,
        eg.image_type,
        eg.image_url,
        eg.storage_path,
        eg.file_name,
        eg.mime_type,
        eg.file_size,
        eg.alt_text,
        eg.sort_order,
        eg.is_primary,
        eg.created_at,
        eg.updated_at,

        e.id AS event_id_ref,
        e.title AS event_title,
        e.slug AS event_slug,
        e.eventDate AS event_date,
        e.startTime AS event_start_time,
        e.endTime AS event_end_time,
        e.location AS event_location,
        e.description AS event_description,
        e.color AS event_color

      FROM event_gallery eg

      LEFT JOIN events e
        ON e.id = eg.event_id

      WHERE eg.event_id = ?

      ORDER BY
        CASE
          WHEN eg.image_type = 'thumbnail' THEN 1
          WHEN eg.image_type = 'hero' THEN 2
          WHEN eg.image_type = 'gallery' THEN 3
          ELSE 4
        END,
        eg.sort_order ASC,
        eg.id ASC
    `,
    [eventId]
  );

  return rows;
};


// =====================================================
// GET SINGLE IMAGE BY ID
// =====================================================

const getById = async (id) => {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        event_id,
        image_type,
        image_url,
        storage_path,
        file_name,
        mime_type,
        file_size,
        alt_text,
        sort_order,
        is_primary,
        created_at,
        updated_at
      FROM event_gallery
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};


// =====================================================
// GET THUMBNAIL
// =====================================================

const getThumbnail = async (eventId) => {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        event_id,
        image_type,
        image_url,
        storage_path,
        file_name,
        mime_type,
        file_size,
        alt_text,
        sort_order,
        is_primary,
        created_at,
        updated_at
      FROM event_gallery
      WHERE event_id = ?
        AND image_type = 'thumbnail'
      ORDER BY id DESC
      LIMIT 1
    `,
    [eventId]
  );

  return rows[0] || null;
};


// =====================================================
// CREATE IMAGE
// =====================================================

const createImage = async ({
  eventId,
  imageType,
  imageUrl,
  storagePath,
  fileName,
  mimeType,
  fileSize,
  altText,
  sortOrder = 0,
  isPrimary = false,
}) => {

  if (!eventId) {
    throw new Error("Event ID is required");
  }

  if (!imageType) {
    throw new Error("Image type is required");
  }

  if (!imageUrl) {
    throw new Error("Image URL is required");
  }

  if (!storagePath) {
    throw new Error("Storage path is required");
  }

  const [result] = await pool.query(
    `
      INSERT INTO event_gallery
      (
        event_id,
        image_type,
        image_url,
        storage_path,
        file_name,
        mime_type,
        file_size,
        alt_text,
        sort_order,
        is_primary
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      eventId,
      imageType,
      imageUrl,
      storagePath,
      fileName || null,
      mimeType || null,
      fileSize || null,
      altText || null,
      Number(sortOrder) || 0,
      isPrimary ? 1 : 0,
    ]
  );

  return getById(result.insertId);
};


// =====================================================
// DELETE IMAGE
// =====================================================

const deleteImage = async (id) => {
  const [result] = await pool.query(
    `
      DELETE FROM event_gallery
      WHERE id = ?
    `,
    [id]
  );

  return result;
};


// =====================================================
// DELETE THUMBNAIL
// =====================================================

const deleteThumbnail = async (eventId) => {
  const [result] = await pool.query(
    `
      DELETE FROM event_gallery
      WHERE event_id = ?
        AND image_type = 'thumbnail'
    `,
    [eventId]
  );

  return result;
};


// =====================================================
// UPDATE IMAGE SORT ORDER
// =====================================================

const updateSortOrder = async (
  id,
  sortOrder
) => {

  await pool.query(
    `
      UPDATE event_gallery
      SET sort_order = ?
      WHERE id = ?
    `,
    [
      Number(sortOrder) || 0,
      id,
    ]
  );

  return getById(id);
};


// =====================================================
// SET PRIMARY IMAGE
// =====================================================

const setPrimary = async (
  id,
  eventId
) => {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    // Remove primary from all images
    await connection.query(
      `
        UPDATE event_gallery
        SET is_primary = 0
        WHERE event_id = ?
      `,
      [eventId]
    );

    // Set selected image as primary
    await connection.query(
      `
        UPDATE event_gallery
        SET is_primary = 1
        WHERE id = ?
          AND event_id = ?
      `,
      [
        id,
        eventId,
      ]
    );

    await connection.commit();

    return getById(id);

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
};


// =====================================================
// DELETE COMPLETE EVENT
// =====================================================

const deleteEvent = async (eventId) => {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    // Delete gallery images
    await connection.query(
      `
        DELETE FROM event_gallery
        WHERE event_id = ?
      `,
      [eventId]
    );

    // Delete event
    await connection.query(
      `
        DELETE FROM events
        WHERE id = ?
      `,
      [eventId]
    );

    await connection.commit();

    return true;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getEventById,
  createEvent,
  updateEvent,
  getAllEventsWithGallery,
  getByEvent,
  getById,
  getThumbnail,
  createImage,
  deleteImage,
  deleteThumbnail,
  updateSortOrder,
  setPrimary,
  deleteEvent,
};