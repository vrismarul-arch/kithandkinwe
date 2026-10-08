const pool = require("../config/db");

const TABLE = "invoices";

// mysql2 auto-parses JSON columns, but guard against null/legacy string rows,
// same pattern as serviceModel.js and leadModel.js.
function normalizeRow(row) {
  if (!row) return row;

  const parseJsonArray = (val) => {
    if (Array.isArray(val)) return val;
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  };

  // MySQL DATE/DATETIME columns can come back as JS Date objects.
  // Force them to a plain "YYYY-MM-DD" string.
  const toDateOnly = (val) => {
    if (!val) return val;
    if (val instanceof Date) {
      return val.toISOString().split("T")[0]; // "2026-08-03"
    }
    if (typeof val === "string") {
      return val.split("T")[0];
    }
    return val;
  };

  return {
    ...row,
    servicesPromised: parseJsonArray(row.servicesPromised),
    deliverables: parseJsonArray(row.deliverables),
    termsAndConditions: parseJsonArray(row.termsAndConditions),
    eventDate: toDateOnly(row.eventDate),
    invoiceDate: toDateOnly(row.invoiceDate),
    dueDate: toDateOnly(row.dueDate),
    discountValue: row.discountValue != null ? Number(row.discountValue) : 0,
    taxPercent: row.taxPercent != null ? Number(row.taxPercent) : 18,
    projectValue: row.projectValue != null ? Number(row.projectValue) : 0,
  };
}

// Columns used for INSERT. The "?" placeholders are generated from this
// list, so the column count and value count can never mismatch again.
const INSERT_COLUMNS = [
  "invoiceNo",
  "invoiceDate",
  "dueDate",
  "clientName",
  "clientAddress",
  "clientPhone",
  "clientEmail",
  "eventType",
  "eventDate",
  "venue",
  "maxHours",
  "servicesPromised",
  "deliverables",
  "complimentary",
  "deliveryNote",
  "projectValue",
  "discountType",
  "discountValue",
  "taxPercent",
  "termsAndConditions",
  "status",
];

const JSON_COLUMNS = ["servicesPromised", "deliverables", "termsAndConditions"];

const InvoiceModel = {
  async findAll() {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} ORDER BY createdAt DESC`);
    return rows.map(normalizeRow);
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);
    return normalizeRow(rows[0]) || null;
  },

  async findByInvoiceNo(invoiceNo) {
    const [rows] = await pool.query(
      `SELECT * FROM ${TABLE} WHERE invoiceNo = ? LIMIT 1`,
      [invoiceNo]
    );
    return normalizeRow(rows[0]) || null;
  },

  async create({
    invoiceNo,
    invoiceDate,
    dueDate,
    clientName,
    clientAddress,
    clientPhone,
    clientEmail,
    eventType,
    eventDate,
    venue,
    maxHours,
    servicesPromised,
    deliverables,
    complimentary,
    deliveryNote,
    projectValue,
    discountType,
    discountValue,
    taxPercent,
    termsAndConditions,
    status,
  }) {
    // Must follow the exact same order as INSERT_COLUMNS
    const values = [
      invoiceNo,
      invoiceDate || null,
      dueDate || null,
      clientName,
      clientAddress || null,
      clientPhone || null,
      clientEmail || null,
      eventType,
      eventDate,
      venue,
      maxHours || null,
      JSON.stringify(servicesPromised || []),
      JSON.stringify(deliverables || []),
      complimentary || null,
      deliveryNote || null,
      projectValue,
      discountType || "flat",
      discountValue || 0,
      taxPercent != null ? taxPercent : 18,
      JSON.stringify(termsAndConditions || []),
      status || "Draft",
    ];

    const placeholders = INSERT_COLUMNS.map(() => "?").join(", ");

    const [result] = await pool.query(
      `INSERT INTO ${TABLE} (${INSERT_COLUMNS.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return this.findById(result.insertId);
  },

  async update(id, data) {
    const keys = Object.keys(data).filter(
      (k) => INSERT_COLUMNS.includes(k) && data[k] !== undefined
    );
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) =>
      JSON_COLUMNS.includes(k) ? JSON.stringify(data[k] || []) : data[k]
    );
    values.push(id);

    await pool.query(`UPDATE ${TABLE} SET ${setClause} WHERE id = ?`, values);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },
};

module.exports = InvoiceModel;