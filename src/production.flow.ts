export const STAGE_FLOW = {
  AKUPLE: {
    next: ['MOTOR_MONTAJ', 'PANO_TESISAT'],
  },

  MOTOR_MONTAJ: {
    parallelGroup: 'ENGINE_GROUP',
  },

  PANO_TESISAT: {
    parallelGroup: 'ENGINE_GROUP',
  },

  ENGINE_GROUP: {
    next: ['KABIN_GIYDIRME'],
  },

  KABIN_GIYDIRME: {
    next: ['TEST'],
  },

  TEST: {
    next: ['FINAL'],
  },

  FINAL: {
    next: [],
  },
} as const;
