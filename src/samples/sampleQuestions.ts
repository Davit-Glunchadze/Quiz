import type { Question } from "../core/types";

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 81,
    type: "mcq",
    points: 2,
    text: "გადაადგილების რამდენი ხერხი არსებობს?",
    options: [
      { id: "1", text: "2" },
      { id: "2", text: "3" },
      { id: "3", text: "4" },
      { id: "4", text: "5" }
    ],
    correct: "2",
    shuffleOptions: true
  },
  {
    id: 82,
    type: "mcq",
    points: 2,
    text: "რომელი ნიშანი ეკუთვნის ოპერაციულ სიმბოლიკას?",
    options: [
      { id: "1", text: "△" },
      { id: "2", text: "⚙" },
      { id: "3", text: "★" }
    ],
    correct: "3",
    shuffleOptions: true
  },
  {
    id: 1,
    type: "written",
    points: 5,
    mode: "list",
    text: "დაწერეთ გამოტოვებული გადაადგილების საბრძოლო წყობები:",
    list: {
      full: [
        { value: "სალაშქრო კოლონა" },
        { value: "გაშლილი მწყობრი" },
        { value: "V-ებრი წყობა" },
        { value: "სოლისებრი წყობა" },
        { value: "წყობა მწკრივში" },
        { value: "წყობა ეშელონებად მარჯვნივ და მარცხნივ" }
      ],
      show_ratio: 0.25,
      order_sensitive: false
    },
    allow_partial_credit: true
  },
  {
    id: 22,
    type: "written",
    points: 5,
    mode: "single",
    text: "ჩაწერე საქართველოს დედაქალაქი.",
    answer_variants: ["თბილისი", "tbilisi"],
    allow_fuzzy: true
  },
  {
    id: 23,
    type: "written",
    points: 5,
    mode: "single",
    text: "როგორ იწერება 'ქარ' ინგლისურად (შეცდომის დაშვება)?",
    answer_variants: ["wind"],
    allow_fuzzy: true
  },
  {
    id: 24,
    type: "written",
    points: 5,
    mode: "list",
    text: "ჩამოთვალეთ საბრძოლო ქვეგანყოფილებები:",
    list: {
      full: [
        { value: "უსაფრთხოების ძალა" },
        { value: "მხარდამჭერი ძალა" },
        { value: "მოიერიშე ძალა" }
      ],
      show_ratio: 0.25,
      order_sensitive: false
    },
    allow_partial_credit: true
  },
  {
    id: 25,
    type: "written",
    points: 5,
    mode: "single",
    text: "ჩაწერე 'მოიერიშე ძალა' (შეიძლება მარტო ძირითადი სიტყვა).",
    answer_variants: ["მოიერიშე ძალა", "მოიერიშე"],
    allow_fuzzy: true
  },
  // small extras to validate logic
  {
    id: 69,
    type: "mcq",
    points: 2,
    text: "< განახლებული მიმდინარე შეფასებები >",
    options: [
      { id: "a", text: "სტატუსი A" },
      { id: "b", text: "სტატუსი B" },
      { id: "c", text: "სტატუსი C" }
    ],
    correct: "b",
    shuffleOptions: true
  },
  {
    id: 90,
    type: "written",
    points: 5,
    mode: "single",
    text: "ჩაწერე სინონიმი სიტყვა 'გაშლილი' (მოეთხოვება ფაზა)",
    answer_variants: ["გაბნეული", "გაფანტული", "გაშლილი"],
    allow_fuzzy: true
  }
];
