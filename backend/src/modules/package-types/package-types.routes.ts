import { Router } from 'express';
import { allowRoles } from '../../middlewares/auth.js';
import { emptyQuery, idParams, parse } from '../../shared/validation.js';
import { createPackageTypeSchema, packageTypesQuerySchema, patchPackageTypeSchema } from './package-types.validation.js';
import { getPackageType, listPackageTypes, patchPackageType } from './package-types.service.js';
import { insertPackageType } from './package-types.repository.js';

export const packageTypesRouter = Router();

packageTypesRouter.get('/', allowRoles('ADMIN'), async (req, res) => {
  res.json(await listPackageTypes(parse(packageTypesQuerySchema, req.query, 400)));
});

packageTypesRouter.post('/', allowRoles('ADMIN'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.status(201).json({ data: await insertPackageType(parse(createPackageTypeSchema, req.body)) });
});

packageTypesRouter.get('/:id', allowRoles('ADMIN'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json({ data: await getPackageType(parse(idParams, req.params, 400).id) });
});

packageTypesRouter.patch('/:id', allowRoles('ADMIN'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json({
    data: await patchPackageType(
      parse(idParams, req.params, 400).id,
      parse(patchPackageTypeSchema, req.body),
    ),
  });
});
