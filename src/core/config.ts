export const TEST_CONFIG = {
  MCQ_PER_TEST: 25,
  WRITTEN_PER_TEST: 10,
  TOTAL_POINTS: 100,
  WRITTEN_REVEAL_MODE: 'one' as 'quarter' | 'one' | 'none',
};

export const STORAGE_KEYS = {
  BAG_MCQ: "quiz.bag.mcq",
  BAG_WRITTEN: "quiz.bag.written",
  BANK_CACHE: "quiz.bank.cache.v1",
};

export const FUZZY = {
  enableByDefaultSingle: true,
  acceptFullAt: 0.85,
  acceptPartialAt: 0.6,
  minLenForLev: 6,
};
