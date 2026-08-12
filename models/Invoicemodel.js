const pool = require("../config/db");

const TABLE = "invoices";

// mysql2 auto-parses JSON columns, but guard against null/legacy string rows,
// same pattern as serviceModel.js and leadModel.js.
function normalizeRow(row) {
  if (!row) return row;

  const parseJsonArray = (val) => (Array.isArray(val) ? val : val ? JSON.parse(val) : []);

  // MySQL DATE/DATETIME columns can come back as JS Date objects
  // (depending on driver config), which serialize/display as
  // "Mon Aug 03 2026 00:00:00 GMT+0530 (India Standard Time)".
  // Force them to a plain "YYYY-MM-DD" string instead, regardless
  // of whether the driver handed us a Date object or an ISO string.
  const toDateOnly = (val) => {
    if (!val) return val;
    if (val instanceof Date) {
      return val.toISOString().split("T")[0]; // "2026-08-03"
    }
    if (typeof val === "string") {
      return val.split("T")[0]; // already a string (ISO or plain) -> strip time part if present
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
    const [result] = await pool.query(
      `INSERT INTO ${TABLE} (
        invoiceNo, invoiceDate, dueDate, clientName, clientAddress, clientPhone, clientEmail,
        eventType, eventDate, venue, maxHours,
        servicesPromised, deliverables, complimentary, deliveryNote,
        projectValue, discountType, discountValue, taxPercent, termsAndConditions, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = [
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

    const keys = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined);
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => {
      if (k === "servicesPromised" || k === "deliverables" || k === "termsAndConditions") {
        return JSON.stringify(data[k] || []);
      }
      return data[k];
    });
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