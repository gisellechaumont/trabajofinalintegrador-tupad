import { Router } from 'express';
import {
  allowRoles,
  identity,
} from '../../middlewares/auth.js';
import {
  emptyQuery,
  idParams,
  parse,
} from '../../shared/validation.js';
import {
  cancelClass,
  createClass,
  createClassesBatch,
  getClass,
  listClasses,
  patchClass,
} from './classes.service.js';
import {
  classesQuerySchema,
  createClassesBatchSchema,
  createClassSchema,
  patchClassSchema,
} from './classes.validation.js';

export const classesRouter = Router();

classesRouter.get('/', async (req, res) => {
  res.json(
    await listClasses(
      parse(
        classesQuerySchema,
        req.query,
        400,
      ),
      identity(req),
    ),
  );
});

classesRouter.post(
  '/',
  allowRoles('ADMIN'),
  async (req, res) => {
    parse(emptyQuery, req.query, 400);

    res.status(201).json({
      data: await createClass(
        parse(createClassSchema, req.body),
      ),
    });
  },
);

classesRouter.post(
  '/batch',
  allowRoles('ADMIN'),
  async (req, res) => {
    parse(emptyQuery, req.query, 400);

    res.status(201).json({
      data: await createClassesBatch(
        parse(createClassesBatchSchema, req.body),
      ),
    });
  },
);

classesRouter.post(
  '/:id/cancel',
  allowRoles('ADMIN'),
  async (req, res) => {
    parse(emptyQuery, req.query, 400);
    parse(emptyQuery, req.body ?? {}, 400);

    res.json({
      data: await cancelClass(
        parse(idParams, req.params, 400).id,
      ),
    });
  },
);

classesRouter.get(
  '/:id',
  async (req, res) => {
    parse(emptyQuery, req.query, 400);

    res.json({
      data: await getClass(
        parse(idParams, req.params, 400).id,
        identity(req),
      ),
    });
  },
);

classesRouter.patch(
  '/:id',
  allowRoles('ADMIN'),
  async (req, res) => {
    parse(emptyQuery, req.query, 400);

    res.json({
      data: await patchClass(
        parse(idParams, req.params, 400).id,
        parse(patchClassSchema, req.body),
      ),
    });
  },
);
