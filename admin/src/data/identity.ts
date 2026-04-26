// Public-facing professional identity. Resume header, ATS top, plain-text top,
// recruiter messaging — all read from here. The professional name is "Moe Qadan"
// across every output. Do not reintroduce a separate "legal name" field.
export const identity = {
  name: 'Moe Qadan',
  fullName: 'Moe Qadan',
  location: 'Los Angeles',
  email: 'moe@qadan.co',
  site: 'https://qadan.co',
  linkedin: 'https://linkedin.com/in/mqadan',
  github: 'https://github.com/qadanm',
} as const;

export type Identity = typeof identity;
