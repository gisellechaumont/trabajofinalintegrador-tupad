import { Router } from 'express';
import { requireAuth, allowRoles } from '../../middlewares/auth.js';
import { parse, idParams, emptyQuery } from '../../shared/validation.js';
import { createUserSchema, patchUserSchema, usersQuerySchema } from './users.validation.js';
import { listUsers } from './users.repository.js';
import { createUser, getManageableUser, patchUser } from './users.service.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, allowRoles('ADMIN'));
usersRouter.get('/', async (req, res) => res.json(await listUsers(parse(usersQuerySchema, req.query, 400))));
usersRouter.post('/', async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.status(201).json({ data: await createUser(parse(createUserSchema, req.body)) });
});
usersRouter.get('/:id', async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json({ data: await getManageableUser(parse(idParams, req.params, 400).id) });
});
usersRouter.patch('/:id', async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json({ data: await patchUser(parse(idParams, req.params, 400).id, parse(patchUserSchema, req.body)) });
});
