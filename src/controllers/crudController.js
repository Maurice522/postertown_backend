import { models } from "../models/index.js";

function singular(collectionName) {
  return collectionName.endsWith("s") ? collectionName.slice(0, -1) : collectionName;
}

function createId(collectionName) {
  return `${singular(collectionName)}-${Date.now()}`;
}

export function createCrudController(collectionName) {
  const Model = models[collectionName];

  if (!Model) {
    throw new Error(`No model registered for '${collectionName}'`);
  }

  return {
    async list(req, res, next) {
      try {
        const filter = Object.fromEntries(
          Object.entries(req.query || {}).filter(([, value]) => value !== undefined && value !== "")
        );
        const items = await Model.find(filter).sort({ createdAt: -1 }).lean({ virtuals: false });
        res.json(items.map(({ _id, ...item }) => item));
      } catch (error) {
        next(error);
      }
    },

    async getById(req, res, next) {
      try {
        const item = await Model.findOne({ id: req.params.id }).lean({ virtuals: false });

        if (!item) {
          return res.status(404).json({ message: `${singular(collectionName)} not found` });
        }

        delete item._id;
        res.json(item);
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        const payload = {
          ...req.body,
          id: req.body.id ?? createId(collectionName)
        };

        const item = await Model.create(payload);
        res.status(201).json(item.toJSON());
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ message: `An item with id '${req.body.id}' already exists` });
        }

        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const { id, _id, ...updates } = req.body;
        const item = await Model.findOneAndUpdate(
          { id: req.params.id },
          { $set: updates },
          { new: true, runValidators: true }
        );

        if (!item) {
          return res.status(404).json({ message: `${singular(collectionName)} not found` });
        }

        res.json(item.toJSON());
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const item = await Model.findOneAndDelete({ id: req.params.id });

        if (!item) {
          return res.status(404).json({ message: `${singular(collectionName)} not found` });
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  };
}
