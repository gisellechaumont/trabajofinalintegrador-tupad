import { Router } from 'express';
import { allowRoles, identity } from '../../middlewares/auth.js';
import { emptyQuery, idParams, parse } from '../../shared/validation.js';
import { assignMemberPackage, getMemberPackage, listMemberPackages } from './member-packages.service.js';
import { createMemberPackageSchema, memberPackagesQuerySchema } from './member-packages.validation.js';

export const memberPackagesRouter = Router();

memberPackagesRouter.post('/', allowRoles('ADMIN'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.status(201).json(await assignMemberPackage(parse(createMemberPackageSchema, req.body)));
});

memberPackagesRouter.get('/', allowRoles('ADMIN', 'MEMBER'), async (req, res) => {
  res.json(await listMemberPackages(parse(memberPackagesQuerySchema, req.query, 400), identity(req)));
});

memberPackagesRouter.get('/:id', allowRoles('ADMIN', 'MEMBER'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json(await getMemberPackage(parse(idParams, req.params, 400).id, identity(req)));
});
