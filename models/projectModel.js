const pool = require("../config/db");

const TABLE = "projects";

function parseJsonField(val, fallback) {
  if (Array.isArray(val)) return val;
  if (val === null || val === undefined) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// Same fix as eventModel.js's toDateOnly: mysql2 returns DATE columns as
// JS Date objects, and JSON.stringify() serializes those via .toISOString()
// which converts to UTC — shifting the date back a day for any timezone
// ahead of UTC (e.g. IST). Pulling local Y/M/D off the Date object instead
// reconstructs the date actually stored, as a plain "YYYY-MM-DD" string.
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

// DB row -> shape the frontend (ProjectsDashboard.jsx / ProjectDrawer.jsx) expects
function toFrontend(row) {
  if (!row) return row;
  return {
    id: row.id,
    column: row.boardColumn,
    tag: row.tag,
    title: row.title,
    description: row.description,
    progress: row.progress,
    team: parseJsonField(row.team, []),
    status: row.status,
    priority: row.priority,
    account: row.account,
    service: row.service,
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    // Each step is stored as a plain object inside this JSON array, so any
    // fields on a step — including the newer `message` / `attachmentUrl`
    // added per-step in the drawer — round-trip automatically without any
    // schema or mapping change here.
    steps: parseJsonField(row.steps, []),
    attachments: parseJsonField(row.attachments, []),
    notes: parseJsonField(row.notes, []),
    // Was previously missing from this model entirely, so the drawer's
    // "Add Service(s)" flow would send serviceIds on create/update but they
    // were silently dropped and never persisted. Now stored as JSON, same
    // pattern as team/steps/attachments/notes.
    serviceIds: parseJsonField(row.serviceIds, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const ProjectModel = {
  async findAll() {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} ORDER BY createdAt DESC`);
    return rows.map(toFrontend);
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toFrontend(rows[0]) : null;
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE}
        (boardColumn, tag, title, description, progress, team, status, priority, account, service, startDate, endDate, steps, attachments, notes, serviceIds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.column || "Started",
        data.tag || null,
        data.title,
        data.description || "",
        data.progress || 0,
        JSON.stringify(data.team || []),
        data.status || "Planned",
        data.priority || "Medium",
        data.account || "",
        data.service || "",
        data.startDate || null,
        data.endDate || null,
        JSON.stringify(data.steps || []),
        JSON.stringify(data.attachments || []),
        JSON.stringify(data.notes || []),
        JSON.stringify(data.serviceIds || []),
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fieldMap = {
      column: "boardColumn",
      tag: "tag",
      title: "title",
      description: "description",
      progress: "progress",
      team: "team",
      status: "status",
      priority: "priority",
      account: "account",
      service: "service",
      startDate: "startDate",
      endDate: "endDate",
      steps: "steps",
      attachments: "attachments",
      notes: "notes",
      serviceIds: "serviceIds",
    };
    const jsonFields = ["team", "steps", "attachments", "notes", "serviceIds"];

    const setClauses = [];
    const values = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key] === undefined) continue;
      setClauses.push(`${column} = ?`);
      values.push(jsonFields.includes(key) ? JSON.stringify(data[key]) : data[key]);
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

module.exports = ProjectModel;