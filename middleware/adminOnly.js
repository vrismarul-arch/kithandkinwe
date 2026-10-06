function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const role = String(req.user.role || "").toLowerCase();

  if (
    role !== "admin" &&
    role !== "superadmin"
  ) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
}

module.exports = adminOnly;