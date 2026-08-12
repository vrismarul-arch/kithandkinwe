const EventModel = require("../models/eventModel");

const eventController = {
  async getAll(req, res, next) {
    try {
      const events = await EventModel.findAll();
      res.json({ data: events });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const event = await EventModel.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json({ data: event });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      if (!req.body.title || !req.body.title.trim()) {
        return res.status(400).json({ message: "title is required" });
      }
      if (!req.body.date) {
        return res.status(400).json({ message: "date is required" });
      }
      const event = await EventModel.create(req.body);
      res.status(201).json({ data: event });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const existing = await EventModel.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Event not found" });

      const updated = await EventModel.update(req.params.id, req.body);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await EventModel.remove(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Event not found" });
      res.json({ message: "Event deleted" });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = eventController;