export type ManagedRole = 'MEMBER' | 'PROFESSOR';
export const userPaths = (role: ManagedRole) => role === 'MEMBER' ? '/admin/socios' : '/admin/profesores';
export const userLabels = (role: ManagedRole) => role === 'MEMBER'
  ? { plural: 'Socios', singular: 'socio', create: 'Registrar socio' }
  : { plural: 'Profesores', singular: 'profesor', create: 'Registrar profesor' };
