export type Common = {
  id: number;
  type: "mcq" | "written";
  points: number; // 2 or 5
  text: string;
  images?: { question?: string[]; answer_key?: string[] };
};

export type MCQOption = { id: string; text?: string; image?: string; alt?: string };
export type MCQ = Common & {
  type: "mcq";
  options: MCQOption[];
  correct: string; // option id
  shuffleOptions?: boolean;
};

export type WrittenSingle = Common & {
  type: "written";
  mode: "single";
  answer_variants: string[];
  allow_fuzzy?: boolean;
  normalize_numbers?: boolean;
};

export type ListItem = { value: string; synonyms?: string[] };
export type WrittenList = Common & {
  type: "written";
  mode: "list";
  list: { full: ListItem[]; show_ratio: number; order_sensitive?: boolean };
  allow_partial_credit?: boolean; // default ON
};

export type Question = MCQ | WrittenSingle | WrittenList;

// Per-blank review row for written list scoring
export type ListRowReview = { user: string; expected: string; ratio: number; okFull: boolean };

export type TestItem = {
  q: Question;

  // MCQ
  mcqSelected?: string;
  mcqDesiredSlot?: number; // 1..N slot for correct answer
  mcqOptionsPrepared?: MCQOption[]; // <- prepared with seeded RNG

  // Written Single
  singleText?: string;

  // Written List
  listShown?: ListItem[];
  listHidden?: ListItem[];
  listAnswers?: string[]; // user answers for hidden
};
