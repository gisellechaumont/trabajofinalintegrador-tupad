import { Router } from 'express';
import { allowRoles, identity } from '../../middlewares/auth.js';
import { emptyQuery, emptyQuery as emptyBody, idParams, parse } from '../../shared/validation.js';
import { cancel, detail, enroll, list } from './enrollments.service.js';
import {
  enrollmentCreateAdminSchema,
  enrollmentCreateMemberSchema,
  enrollmentIdParamsSchema,
  enrollmentsQuerySchema,
} from './enrollments.validation.js';

export const enrollmentsRouter = Router();

enrollmentsRouter.post('/', allowRoles('ADMIN', 'MEMBER'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  const requester = identity(req);
  const body = requester.role === 'ADMIN'
    ? parse(enrollmentCreateAdminSchema, req.body)
    : parse(enrollmentCreateMemberSchema, req.body);
  res.status(201).json(await enroll(body.classId, body.memberId, requester));
});

enrollmentsRouter.get('/', allowRoles('ADMIN', 'MEMBER'), async (req, res) => {
  const requester = identity(req);
  res.json(await list(parse(enrollmentsQuerySchema, req.query, 400), requester));
});

enrollmentsRouter.get('/:id', allowRoles('ADMIN', 'MEMBER'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  res.json(await detail(parse(enrollmentIdParamsSchema, req.params, 400).id, identity(req)));
});

enrollmentsRouter.post('/:id/cancel', allowRoles('ADMIN', 'MEMBER'), async (req, res) => {
  parse(emptyQuery, req.query, 400);
  parse(emptyBody, req.body ?? {}, 422);
  const id = parse(idParams, req.params, 400).id;
  res.json(await cancel(id, identity(req)));
});
