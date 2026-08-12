const ProjectModel = require("../models/projectModel");

const projectController = {
  async getAll(req, res, next) {
    try {
      const projects = await ProjectModel.findAll();
      res.json({ data: projects });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      if (!req.body.title || !req.body.title.trim()) {
        return res.status(400).json({ message: "title is required" });
      }
      const project = await ProjectModel.create(req.body);
      res.status(201).json({ data: project });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const existing = await ProjectModel.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Project not found" });

      const updated = await ProjectModel.update(req.params.id, req.body);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await ProjectModel.remove(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Project not found" });
      res.json({ message: "Project deleted" });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = projectController;