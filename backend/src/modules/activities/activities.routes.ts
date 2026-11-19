import { Router } from 'express';
import { requireAuth, allowRoles, identity } from '../../middlewares/auth.js';
import { parse, idParams, emptyQuery } from '../../shared/validation.js';
import { activitiesQuerySchema, createActivitySchema, patchActivitySchema } from './activities.validation.js';
import { listActivities, getActivity, patchActivity } from './activities.service.js';
import { insertActivity } from './activities.repository.js';

export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);
activitiesRouter.get('/', async (req, res) => res.json(await listActivities(parse(activitiesQuerySchema, req.query, 400), identity(req).role)));
activitiesRouter.get('/:id', async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json({ data: await getActivity(parse(idParams, req.params, 400).id, identity(req).role) });
});
activitiesRouter.post('/', allowRoles('ADMIN'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.status(201).json({ data: await insertActivity(parse(createActivitySchema, req.body)) });
});
activitiesRouter.patch('/:id', allowRoles('ADMIN'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json({ data: await patchActivity(parse(idParams, req.params, 400).id, parse(patchActivitySchema, req.body)) });
});
