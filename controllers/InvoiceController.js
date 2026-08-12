const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const puppeteer = require("puppeteer");
const InvoiceModel = require("../models/invoiceModel");
const { validateInvoicePayload } = require("../middleware/validators");

// ------------------------------------------------------------------
// STATIC BUSINESS INFO — same on every invoice, so it lives here
// instead of being stored per-row in the DB. Edit these once.
// ------------------------------------------------------------------
const BUSINESS_INFO = {
  bankName: "HDFC Bank",
  accountName: "Kith & Kin Photography & Films",
  accountNo: "50200012345678",
  ifscCode: "HDFC0001234",
  upiId: "kithandkin@upi",
  phone: "+91 12345 67890",
  email: "hello@kithandkin.com",
  website: "www.kithandkin.com",
  address: "Chennai, Tamil Nadu, India",
};

const DEFAULT_TERMS = [
  "50% advance payment is required to confirm the booking.",
  "Balance payment to be made before the event.",
  "Cancellations are not refundable.",
  "Raw files will not be provided.",
];

// Normalizes servicesPromised — carries description/package/rate/category
// so both the DOCX template and the PDF renderer show the
// "BASIC SERVICES" / "ADD ON SERVICES" tables the same way.
const normalizeServicesPromised = (services = []) =>
  services.map((s) => ({
    serviceName: String(s.serviceName || "").trim(),
    description: s.description ? String(s.description).trim() : "",
    package: s.package ? String(s.package).trim() : "",
    quantity:
      s.quantity !== undefined && s.quantity !== null && s.quantity !== ""
        ? Number(s.quantity)
        : 1,
    rate:
      s.rate !== undefined && s.rate !== null && s.rate !== "" ? Number(s.rate) : 0,
    category: s.category === "addon" ? "addon" : "basic",
  }));

const normalizeDeliverables = (deliverables = []) =>
  deliverables.map((d) => ({
    name: String(d.name).trim(),
    timeline: d.timeline ? String(d.timeline).trim() : null,
  }));

const normalizeTerms = (terms = []) =>
  (Array.isArray(terms) ? terms : [])
    .map((t) => String(t).trim())
    .filter(Boolean);

/* ------------------------------------------------------------------------
   TEMPLATE CONFIGURATION

   TWO SEPARATE OUTPUT PIPELINES (this is the important change):

   DOCX  -> still generated from public/templates/k&K.docx via
            docxtemplater, exactly as before. Untouched.

   PDF   -> NO LONGER goes through the docx/mammoth route. It is now
            built directly from HTML/CSS designed to match the studio's
            branded invoice layout (colored pill headers, circular
            service icons, highlighted total bar, footer, etc.), then
            rendered to PDF with Puppeteer. This sidesteps mammoth
            entirely, which is what was silently dropping the logo
            (mammoth can't read VML/WordArt shapes) and causing the
            downstream PDF corruption issues. It also renders faster,
            since it skips the docx round-trip.
   ------------------------------------------------------------------------ */

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "public",
  "templates",
  "k&K.docx"
);

// Logo used in the PDF header. Point this at your actual logo file
// (PNG/JPG — SVG also works). Falls back to a text wordmark if the
// file isn't found, so a missing logo never breaks PDF generation.
const LOGO_PATH = path.join(__dirname, "..", "public", "assets", "logo.png");

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const formatDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Escapes text before it goes into HTML — invoice fields are free text
// typed by staff, so this prevents a stray "<" or "&" from breaking the
// layout (or, worse, injecting markup) when the PDF is rendered.
const escapeHtml = (val) =>
  String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ============================================================
// CALCULATES amount per line item + subTotal/discount/tax/total.
// This is the ONLY place totals get computed — single source of
// truth, used by both the DOCX template and the PDF renderer.
// ============================================================
const computeTotals = (invoice) => {
  const services = invoice.servicesPromised || [];

  const withAmount = services.map((s) => ({
    ...s,
    amount: Number(s.quantity || 0) * Number(s.rate || 0),
  }));

  const basicServices = withAmount.filter((s) => s.category !== "addon");
  const addonServices = withAmount.filter((s) => s.category === "addon");

  const subTotal = withAmount.reduce((sum, s) => sum + s.amount, 0);

  const discountValue = Number(invoice.discountValue || 0);
  const discountAmount =
    invoice.discountType === "percent" ? (subTotal * discountValue) / 100 : discountValue;

  const taxableAmount = Math.max(subTotal - discountAmount, 0);
  const taxPercent = invoice.taxPercent != null ? Number(invoice.taxPercent) : 18;
  const taxAmount = (taxableAmount * taxPercent) / 100;

  const totalAmount = taxableAmount + taxAmount;

  return {
    basicServices,
    addonServices,
    subTotal,
    discountAmount,
    taxPercent,
    taxAmount,
    totalAmount,
  };
};

// ============================================================
// DOCX TEMPLATE DATA BUILDER — only used by the DOCX download.
// ============================================================
const buildTemplateData = (invoice) => {
  const totals = computeTotals(invoice);

  const mapRow = (s) => ({
    serviceName: s.serviceName || "",
    description: s.description || "",
    package: s.package || "",
    quantity: s.quantity ?? "",
    rate: formatCurrency(s.rate),
    amount: formatCurrency(s.amount),
  });

  return {
    invoiceNo: invoice.invoiceNo || "",
    invoiceDate: formatDate(invoice.invoiceDate),
    dueDate: formatDate(invoice.dueDate),

    clientName: invoice.clientName || "",
    clientAddress: invoice.clientAddress || "",
    clientPhone: invoice.clientPhone || "",
    clientEmail: invoice.clientEmail || "",

    eventType: invoice.eventType || "",
    eventDate: formatDate(invoice.eventDate),
    venue: invoice.venue || "",
    maxHours: invoice.maxHours ?? "",

    basicServices: totals.basicServices.map(mapRow),
    addonServices: totals.addonServices.map(mapRow),

    deliverables: (invoice.deliverables || []).map((d) => ({
      name: d.name || "",
      timeline: d.timeline || "",
    })),

    complimentary: invoice.complimentary || "",
    deliveryNote: invoice.deliveryNote || "",

    subTotal: formatCurrency(totals.subTotal),
    discountAmount: formatCurrency(totals.discountAmount),
    taxPercent: totals.taxPercent,
    taxAmount: formatCurrency(totals.taxAmount),
    totalAmount: formatCurrency(totals.totalAmount),

    termsAndConditions:
      invoice.termsAndConditions && invoice.termsAndConditions.length
        ? invoice.termsAndConditions.map((t) => ({ text: t }))
        : DEFAULT_TERMS.map((t) => ({ text: t })),

    ...BUSINESS_INFO,
  };
};

// ============================================================
// Renders the k&K.docx template for an invoice and returns a
// Buffer of the finished .docx file. Used ONLY by the DOCX
// download route now — the PDF route no longer touches this.
// ============================================================
const renderInvoiceDocxBuffer = (invoice) => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    const err = new Error("Template file not found");
    err.code = "TEMPLATE_MISSING";
    throw err;
  }

  const content = fs.readFileSync(TEMPLATE_PATH, "binary");
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  const data = buildTemplateData(invoice);

  try {
    doc.render(data);
  } catch (renderError) {
    if (renderError.properties && renderError.properties.errors) {
      const wrapped = new Error("Template placeholder mismatch");
      wrapped.code = "TEMPLATE_MISMATCH";
      wrapped.details = renderError.properties.errors.map((e) => ({
        message: e.message || e.properties?.explanation || "Unknown error",
        id: e.id || "unknown",
      }));
      throw wrapped;
    }
    throw renderError;
  }

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
};

const TEMPLATE_MISMATCH_HINT =
  "Your k&K.docx template must contain these placeholders — see the field list " +
  "in the chat reply for the full table of tags to paste into the template.";

// ============================================================
// ICONS — small inline SVGs (not emoji/webfont dependent, so they
// render identically no matter what fonts are installed on the
// server). One per common service keyword, with a generic camera
// icon fallback for anything unmatched.
// ============================================================
const ICONS = {
  camera:
    '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  video:
    '<rect x="3" y="7" width="12" height="10" rx="1.5"/><path d="M15 10.5l6-3v9l-6-3z"/>',
  people:
    '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><path d="M3 18c0-3 2.5-5 5-5s5 2 5 5"/><path d="M11 18c0-2.5 2-4.5 5-4.5s5 2 5 4.5"/>',
  drone:
    '<circle cx="12" cy="12" r="2.2"/><path d="M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5"/><circle cx="5" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/>',
  wifi:
    '<path d="M4 9a12 12 0 0 1 16 0"/><path d="M7 12.5a8 8 0 0 1 10 0"/><path d="M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/>',
};

const pickIcon = (serviceName = "") => {
  const s = serviceName.toLowerCase();
  if (/(pre.?wedding|people|family|group)/.test(s)) return ICONS.people;
  if (/(drone|aerial)/.test(s)) return ICONS.drone;
  if (/(live|stream|wifi)/.test(s)) return ICONS.wifi;
  if (/(video|film|cinemat)/.test(s)) return ICONS.video;
  return ICONS.camera;
};

const iconCircle = (serviceName) => `
  <span class="svc-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      ${pickIcon(serviceName)}
    </svg>
  </span>`;

const CONTACT_ICONS = {
  phone: '<path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a2 2 0 0 1-2 2C9.5 22 2 14.5 2 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  pin: '<path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
};

const contactIcon = (name) => `
  <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${CONTACT_ICONS[name]}
  </svg>`;

// Reads the logo file (if present) and returns it as a base64 data URI
// for embedding directly in the PDF's HTML. Missing logo never breaks
// generation — it just falls back to a text wordmark.
const getLogoDataUri = () => {
  try {
    if (!fs.existsSync(LOGO_PATH)) return null;
    const ext = path.extname(LOGO_PATH).slice(1).toLowerCase();
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    const base64 = fs.readFileSync(LOGO_PATH).toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
};

// ============================================================
// Renders one service table (BASIC SERVICES / ADD ON SERVICES).
// ============================================================
const renderServiceTable = (title, rows) => {
  if (!rows.length) return "";
  const bodyRows = rows
    .map(
      (s) => `
      <tr>
        <td class="svc-cell">
          ${iconCircle(s.serviceName)}
          <span class="svc-text">
            <strong>${escapeHtml(s.serviceName)}</strong>
            ${s.description ? `<span class="svc-desc">${escapeHtml(s.description)}</span>` : ""}
          </span>
        </td>
        <td>${escapeHtml(s.package) || "&mdash;"}</td>
        <td>${escapeHtml(s.quantity)}</td>
        <td>${formatCurrency(s.rate)}</td>
        <td class="amount-cell">${formatCurrency(s.amount)}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="section-pill">${title}</div>
    <table class="service-table">
      <thead>
        <tr>
          <th>DESCRIPTION</th>
          <th>PACKAGE</th>
          <th>QTY</th>
          <th>RATE (₹)</th>
          <th>AMOUNT (₹)</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
};

// ============================================================
// MAIN: builds the full invoice as a standalone HTML document,
// styled to match the studio's branded invoice layout. This is
// what gets handed to Puppeteer to produce the PDF.
// ============================================================
const buildInvoiceHtml = (invoice) => {
  const totals = computeTotals(invoice);
  const terms =
    invoice.termsAndConditions && invoice.termsAndConditions.length
      ? invoice.termsAndConditions
      : DEFAULT_TERMS;

  const logoDataUri = getLogoDataUri();
  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" class="logo-img" alt="logo" />`
    : `<div class="logo-text">Kith<br/>&amp;<br/>Kin.</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Calibri, Arial, sans-serif;
    color: #333;
    margin: 0;
    padding: 22mm 16mm;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .brand-row { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo-text {
    font-family: 'Brush Script MT', cursive;
    font-size: 30pt;
    line-height: 1.05;
    color: #C98A4B;
    font-weight: 600;
  }
  .logo-img { max-height: 70px; max-width: 220px; object-fit: contain; }
  .brand-sub { font-size: 9pt; letter-spacing: 2px; color: #777; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 26pt; letter-spacing: 4px; color: #333; font-weight: 300; margin: 0 0 8px; }
  .meta-row { font-size: 9.5pt; color: #444; margin: 2px 0; }
  .meta-row span.label { display: inline-block; width: 90px; color: #888; }

  hr.divider { border: none; border-top: 1.5px solid #eadfd2; margin: 16px 0; }

  .two-col { display: flex; gap: 24px; margin-bottom: 18px; }
  .two-col > div { flex: 1; }
  .section-pill {
    display: inline-block;
    background: #F3DFC7;
    color: #A9713C;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 5px 14px;
    border-radius: 14px;
    margin-bottom: 10px;
  }
  .info-name { font-weight: 700; font-size: 11pt; margin-bottom: 4px; }
  .info-line { font-size: 9.5pt; color: #555; margin: 1px 0; }
  .kv-row { font-size: 9.5pt; margin: 3px 0; }
  .kv-row span.label { display: inline-block; width: 85px; color: #888; }

  table.service-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.service-table thead th {
    text-align: left;
    font-size: 8pt;
    color: #999;
    letter-spacing: 0.5px;
    padding: 6px 8px;
    border-bottom: 1.5px solid #eee;
  }
  table.service-table tbody td {
    padding: 10px 8px;
    border-bottom: 1px solid #f2f2f2;
    font-size: 9.5pt;
    vertical-align: middle;
  }
  .svc-cell { display: flex; align-items: center; gap: 10px; }
  .svc-icon {
    flex: none;
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 1.5px solid #E3B589;
    color: #C98A4B;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .svc-icon svg { width: 15px; height: 15px; }
  .svc-text { display: flex; flex-direction: column; }
  .svc-desc { font-size: 8.5pt; color: #999; }
  .amount-cell { text-align: right; font-weight: 600; }

  .bottom-row { display: flex; gap: 24px; margin-top: 8px; }
  .payment-card {
    flex: 1.15;
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 16px 18px;
  }
  .totals-card { flex: 1; }
  .totals-box { border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
  .totals-box .row {
    display: flex; justify-content: space-between;
    padding: 9px 16px; font-size: 9.5pt; color: #555;
  }
  .totals-box .row.total {
    background: #C98A4B; color: #fff; font-weight: 700; font-size: 11pt;
    padding: 12px 16px;
  }
  .pay-line { font-size: 9.5pt; margin: 4px 0; color: #444; }
  .pay-line span.label { display: inline-block; width: 95px; color: #888; }
  .terms-list { list-style: none; margin: 8px 0 0; padding: 0; }
  .terms-list li { font-size: 8.8pt; color: #666; margin: 3px 0; padding-left: 12px; position: relative; }
  .terms-list li::before { content: "•"; position: absolute; left: 0; color: #C98A4B; }

  .footer { margin-top: 26px; display: flex; justify-content: space-between; align-items: flex-end; }
  .thank-you { font-family: 'Brush Script MT', cursive; font-size: 20pt; color: #C98A4B; }
  .thank-sub { font-size: 8.5pt; color: #888; margin-top: 2px; }
  .contact-list { text-align: right; }
  .contact-item { display: flex; align-items: center; justify-content: flex-end; gap: 8px; font-size: 9pt; color: #555; margin: 3px 0; }
  .contact-icon { width: 13px; height: 13px; color: #C98A4B; }

  .tagline-bar {
    margin-top: 20px;
    background: #E3B589;
    color: #fff;
    text-align: center;
    padding: 10px;
    font-size: 9pt;
    letter-spacing: 3px;
    border-radius: 6px;
  }
</style>
</head>
<body>

  <div class="brand-row">
    <div>
      ${logoHtml}
      <div class="brand-sub">PHOTOGRAPHY &amp; FILMS</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="meta-row"><span class="label">Invoice No.</span>: ${escapeHtml(invoice.invoiceNo)}</div>
      <div class="meta-row"><span class="label">Invoice Date</span>: ${formatDate(invoice.invoiceDate)}</div>
      <div class="meta-row"><span class="label">Due Date</span>: ${formatDate(invoice.dueDate)}</div>
    </div>
  </div>

  <hr class="divider" />

  <div class="two-col">
    <div>
      <div class="section-pill">BILL TO</div>
      <div class="info-name">${escapeHtml(invoice.clientName)}</div>
      ${invoice.clientAddress ? `<div class="info-line">${escapeHtml(invoice.clientAddress)}</div>` : ""}
      ${invoice.clientPhone ? `<div class="info-line">Phone: ${escapeHtml(invoice.clientPhone)}</div>` : ""}
      ${invoice.clientEmail ? `<div class="info-line">Email: ${escapeHtml(invoice.clientEmail)}</div>` : ""}
    </div>
    <div>
      <div class="section-pill">EVENT DETAILS</div>
      <div class="kv-row"><span class="label">Event Type</span>: ${escapeHtml(invoice.eventType)}</div>
      <div class="kv-row"><span class="label">Event Date</span>: ${formatDate(invoice.eventDate)}</div>
      <div class="kv-row"><span class="label">Location</span>: ${escapeHtml(invoice.venue)}</div>
      ${invoice.maxHours ? `<div class="kv-row"><span class="label">Max Hours</span>: ${escapeHtml(invoice.maxHours)}</div>` : ""}
    </div>
  </div>

  ${renderServiceTable("BASIC SERVICES", totals.basicServices)}
  ${renderServiceTable("ADD ON SERVICES", totals.addonServices)}

  <div class="bottom-row">
    <div class="payment-card">
      <div class="section-pill">PAYMENT INFORMATION</div>
      <div class="pay-line"><span class="label">Bank Name</span>: ${escapeHtml(BUSINESS_INFO.bankName)}</div>
      <div class="pay-line"><span class="label">Account Name</span>: ${escapeHtml(BUSINESS_INFO.accountName)}</div>
      <div class="pay-line"><span class="label">Account No.</span>: ${escapeHtml(BUSINESS_INFO.accountNo)}</div>
      <div class="pay-line"><span class="label">IFSC Code</span>: ${escapeHtml(BUSINESS_INFO.ifscCode)}</div>
      <div class="pay-line"><span class="label">UPI ID</span>: <strong>${escapeHtml(BUSINESS_INFO.upiId)}</strong></div>

      <div class="section-pill" style="margin-top:14px;">TERMS &amp; CONDITIONS</div>
      <ul class="terms-list">
        ${terms.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
      </ul>
    </div>

    <div class="totals-card">
      <div class="totals-box">
        <div class="row"><span>Sub Total</span><span>${formatCurrency(totals.subTotal)}</span></div>
        <div class="row"><span>Discount</span><span>- ${formatCurrency(totals.discountAmount)}</span></div>
        <div class="row"><span>Tax (${totals.taxPercent}% GST)</span><span>${formatCurrency(totals.taxAmount)}</span></div>
        <div class="row total"><span>TOTAL AMOUNT</span><span>${formatCurrency(totals.totalAmount)}</span></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div>
      <div class="thank-you">Thank You!</div>
      <div class="thank-sub">We capture moments, You cherish forever.</div>
    </div>
    <div class="contact-list">
      <div class="contact-item">${contactIcon("phone")} ${escapeHtml(BUSINESS_INFO.phone)}</div>
      <div class="contact-item">${contactIcon("mail")} ${escapeHtml(BUSINESS_INFO.email)}</div>
      <div class="contact-item">${contactIcon("globe")} ${escapeHtml(BUSINESS_INFO.website)}</div>
      <div class="contact-item">${contactIcon("pin")} ${escapeHtml(BUSINESS_INFO.address)}</div>
    </div>
  </div>

  <div class="tagline-bar">"CAPTURING EMOTIONS. CREATING STORIES."</div>

</body>
</html>`;
};

// ============================================================
// Renders an HTML string to a PDF Buffer via Puppeteer.
// ============================================================
const renderHtmlToPdf = async (html) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    // Everything (logo, icons) is inline SVG/base64 — no external
    // requests — so "load" is sufficient and won't hang.
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    const rawPdfOutput = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
      timeout: 20000,
    });

    // Newer Puppeteer versions can return a Uint8Array instead of a
    // Node Buffer. Normalize so res.send()/Content-Length behave
    // correctly regardless of Puppeteer version.
    const pdfBuffer = Buffer.isBuffer(rawPdfOutput) ? rawPdfOutput : Buffer.from(rawPdfOutput);

    const isValidPdf = pdfBuffer.slice(0, 5).toString("ascii") === "%PDF-";
    if (!isValidPdf) {
      throw new Error(
        `Puppeteer produced an invalid PDF buffer (${pdfBuffer.length} bytes, ` +
          `did not start with %PDF- signature)`
      );
    }

    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
};

const invoiceController = {
  async getAll(req, res, next) {
    try {
      const invoices = await InvoiceModel.findAll();
      res.json({ data: invoices });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const invoice = await InvoiceModel.findById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Quotation not found" });
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      validateInvoicePayload(req.body);

      const existing = await InvoiceModel.findByInvoiceNo(req.body.invoiceNo.trim());
      if (existing) {
        return res.status(409).json({
          errors: { invoiceNo: "This quotation number is already in use" },
        });
      }

      const invoice = await InvoiceModel.create({
        invoiceNo: req.body.invoiceNo.trim(),
        invoiceDate: req.body.invoiceDate || null,
        dueDate: req.body.dueDate || null,
        clientName: req.body.clientName.trim(),
        clientAddress: req.body.clientAddress?.trim(),
        clientPhone: req.body.clientPhone?.trim(),
        clientEmail: req.body.clientEmail?.trim(),
        eventType: req.body.eventType,
        eventDate: req.body.eventDate,
        venue: req.body.venue.trim(),
        maxHours: req.body.maxHours != null ? Number(req.body.maxHours) : null,
        servicesPromised: normalizeServicesPromised(req.body.servicesPromised),
        deliverables: normalizeDeliverables(req.body.deliverables),
        complimentary: req.body.complimentary?.trim(),
        deliveryNote: req.body.deliveryNote?.trim(),
        projectValue: Number(req.body.projectValue),
        discountType: req.body.discountType === "percent" ? "percent" : "flat",
        discountValue: req.body.discountValue != null ? Number(req.body.discountValue) : 0,
        taxPercent: req.body.taxPercent != null ? Number(req.body.taxPercent) : 18,
        termsAndConditions: normalizeTerms(req.body.termsAndConditions),
        status: req.body.status || "Draft",
      });

      res.status(201).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const existingInvoice = await InvoiceModel.findById(id);
      if (!existingInvoice) return res.status(404).json({ message: "Quotation not found" });

      validateInvoicePayload(req.body);

      if (req.body.invoiceNo && req.body.invoiceNo.trim() !== existingInvoice.invoiceNo) {
        const clash = await InvoiceModel.findByInvoiceNo(req.body.invoiceNo.trim());
        if (clash) {
          return res.status(409).json({
            errors: { invoiceNo: "This quotation number is already in use" },
          });
        }
      }

      const updated = await InvoiceModel.update(id, {
        invoiceNo: req.body.invoiceNo?.trim(),
        invoiceDate: req.body.invoiceDate,
        dueDate: req.body.dueDate,
        clientName: req.body.clientName?.trim(),
        clientAddress: req.body.clientAddress?.trim(),
        clientPhone: req.body.clientPhone?.trim(),
        clientEmail: req.body.clientEmail?.trim(),
        eventType: req.body.eventType,
        eventDate: req.body.eventDate,
        venue: req.body.venue?.trim(),
        maxHours: req.body.maxHours != null ? Number(req.body.maxHours) : undefined,
        servicesPromised:
          req.body.servicesPromised !== undefined
            ? normalizeServicesPromised(req.body.servicesPromised)
            : undefined,
        deliverables:
          req.body.deliverables !== undefined
            ? normalizeDeliverables(req.body.deliverables)
            : undefined,
        complimentary: req.body.complimentary?.trim(),
        deliveryNote: req.body.deliveryNote?.trim(),
        projectValue:
          req.body.projectValue !== undefined ? Number(req.body.projectValue) : undefined,
        discountType: req.body.discountType,
        discountValue:
          req.body.discountValue !== undefined ? Number(req.body.discountValue) : undefined,
        taxPercent: req.body.taxPercent !== undefined ? Number(req.body.taxPercent) : undefined,
        termsAndConditions:
          req.body.termsAndConditions !== undefined
            ? normalizeTerms(req.body.termsAndConditions)
            : undefined,
        status: req.body.status,
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await InvoiceModel.remove(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Quotation not found" });
      res.json({ message: "Quotation deleted" });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // GENERATE QUOTATION .DOCX  (unchanged — uses k&K.docx template)
  // ============================================================
  async generateDocx(req, res, next) {
    try {
      const { id } = req.params;

      const invoice = await InvoiceModel.findById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      let buffer;
      try {
        buffer = renderInvoiceDocxBuffer(invoice);
      } catch (renderErr) {
        if (renderErr.code === "TEMPLATE_MISSING") {
          console.error(`Template not found at: ${TEMPLATE_PATH}`);
          return res.status(500).json({
            message: "Template file not found",
            details: "Please ensure k&K.docx exists in public/templates/ directory",
          });
        }
        if (renderErr.code === "TEMPLATE_MISMATCH") {
          console.error("DOCX Render Error:", renderErr.details);
          return res.status(400).json({
            message: "Template placeholder mismatch",
            errors: renderErr.details,
            hint: TEMPLATE_MISMATCH_HINT,
          });
        }
        throw renderErr;
      }

      const fileName = `${invoice.invoiceNo || "Quotation"}.docx`;

      res.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": buffer.length,
        "Cache-Control": "no-cache",
      });

      return res.send(buffer);
    } catch (err) {
      console.error("DOCX generation failed:", err);

      return res.status(500).json({
        message: "Failed to generate DOCX",
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },

  // ============================================================
  // GENERATE QUOTATION .PDF
  // Now built directly from styled HTML (matching the studio's
  // branded invoice layout) instead of via the docx template —
  // no more mammoth, no more VML/logo issues.
  // ============================================================
  async generatePdf(req, res, next) {
    try {
      const { id } = req.params;

      const invoice = await InvoiceModel.findById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const html = buildInvoiceHtml(invoice);

      let pdfBuffer;
      try {
        pdfBuffer = await renderHtmlToPdf(html);
      } catch (convertErr) {
        console.error("HTML -> PDF conversion failed:", convertErr);
        return res.status(500).json({
          message: "Failed to convert quotation to PDF",
          error: convertErr.message,
        });
      }

      const fileName = `${invoice.invoiceNo || "Quotation"}.pdf`;

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length,
        "Cache-Control": "no-cache",
      });

      return res.send(pdfBuffer);
    } catch (err) {
      console.error("PDF generation failed:", err);
      return res.status(500).json({
        message: "Failed to generate PDF",
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },
};

module.exports = invoiceController;