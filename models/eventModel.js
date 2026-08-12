const pool = require("../config/db");

const TABLE = "events";

function parseJsonField(val, fallback) {
  if (Array.isArray(val)) return val;
  if (val === null || val === undefined) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// mysql2 returns DATE columns as JS Date objects. JSON.stringify() calls
// .toISOString() on those, which converts to UTC — for any timezone ahead
// of UTC (e.g. IST, UTC+5:30), local midnight becomes 18:30 the *previous*
// day once serialized. That's exactly what was showing up in the API
// response: a date picked as "Aug 12" round-tripping as
// "2026-08-11T18:30:00.000Z". Pulling the LOCAL Y/M/D off the Date object
// (not the UTC getters) reconstructs the date that was actually stored,
// as a plain "YYYY-MM-DD" string with no timezone info to get mangled.
function toDateOnly(value) {
  if (!value) return value;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return value;
}

// DB row -> shape the frontend (Calendar.jsx) expects.
// NOTE on `attendees`: Calendar.jsx currently stores this as an array of
// email strings (see seedEvents() / the guest input). The updated
// EventModal instead lets you pick real staff from userApi, so this array
// now holds each selected user's email (falling back to name if a user
// has no email) — same shape, just populated from real users instead of
// free-typed text.
function toFrontend(row) {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title,
    date: toDateOnly(row.eventDate),
    startTime: row.startTime,
    endTime: row.endTime,
    description: row.description || "",
    location: row.location || "",
    color: row.color || "#1A73E8",
    repeat: row.repeatType || "none",
    reminder: !!row.reminder,
    reminderMinutes: row.reminderMinutes,
    attendees: parseJsonField(row.attendees, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const EventModel = {
  async findAll() {
    const [rows] = await pool.query(
      `SELECT * FROM ${TABLE} ORDER BY eventDate ASC, startTime ASC`
    );
    return rows.map(toFrontend);
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toFrontend(rows[0]) : null;
  },

  // Optional helper for month/week views to avoid pulling every event ever
  // created. Not wired into the frontend yet — findAll() is used for now —
  // but available if the event list grows large enough to need it.
  async findByRange(startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT * FROM ${TABLE} WHERE eventDate BETWEEN ? AND ? ORDER BY eventDate ASC, startTime ASC`,
      [startDate, endDate]
    );
    return rows.map(toFrontend);
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (title, eventDate, startTime, endTime, description, location, color, repeatType, reminder, reminderMinutes, attendees)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.date,
        data.startTime || null,
        data.endTime || null,
        data.description || "",
        data.location || "",
        data.color || "#1A73E8",
        data.repeat || "none",
        data.reminder ? 1 : 0,
        data.reminderMinutes ?? 15,
        JSON.stringify(data.attendees || []),
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fieldMap = {
      title: "title",
      date: "eventDate",
      startTime: "startTime",
      endTime: "endTime",
      description: "description",
      location: "location",
      color: "color",
      repeat: "repeatType",
      reminder: "reminder",
      reminderMinutes: "reminderMinutes",
      attendees: "attendees",
    };
    const jsonFields = ["attendees"];
    const boolFields = ["reminder"];

    const setClauses = [];
    const values = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key] === undefined) continue;
      setClauses.push(`${column} = ?`);
      if (jsonFields.includes(key)) {
        values.push(JSON.stringify(data[key]));
      } else if (boolFields.includes(key)) {
        values.push(data[key] ? 1 : 0);
      } else {
        values.push(data[key]);
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE ${TABLE} SET ${setClauses.join(", ")} WHERE id = ?`, values);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },
};

module.exports = EventModel;