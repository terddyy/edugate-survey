export type LikertValue = 1 | 2 | 3 | 4 | 5;

export type SurveyQuestion = {
  id: string;
  text: string;
};

export type SurveySection = {
  code: string;
  title: string;
  responseFormat: string;
  questions: SurveyQuestion[];
};

export const LIKERT_OPTIONS: { value: LikertValue; label: string }[] = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];

export const CONSENT_CONTENT = {
  title: "Part 0 · Consent Form",
  introduction:
    "You are invited to participate in an EduGate survey about campus entry and security experience. The purpose of this survey is to gather feedback that can support improvements to campus safety and entry operations.",
  informedConsent:
    "This survey asks for your perceptions about the proposed EduGate system. There are minimal risks expected from participation. Benefits include helping inform school-level decision-making. Your responses will be treated confidentially and used for academic/research purposes only.",
  voluntary:
    "Your participation is voluntary. You may stop at any time before submitting your responses without penalty.",
  contact:
    "For questions about this survey, please contact: [Researcher Name], [Department/Program], [Email Address].",
  agreement:
    "By selecting I Agree, you confirm that you have read and understood this consent information and voluntarily agree to participate.",
};

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    code: "CCEE",
    title: "Part I · Current Campus Entry Experience (CCEE)",
    responseFormat: "5-Point Likert Scale",
    questions: [
      { id: "q1", text: "I usually enter the campus through the main entrance." },
      {
        id: "q2",
        text: "There are times when entering the campus takes longer than expected.",
      },
      { id: "q3", text: "The current campus entry process can be improved." },
      {
        id: "q4",
        text: "Proper monitoring of people entering the campus is important.",
      },
      {
        id: "q5",
        text: "The school would benefit from a more organized campus entry system.",
      },
    ],
  },
  {
    code: "PU",
    title: "Part II · Perceived Usefulness (PU)",
    responseFormat: "5-Point Likert Scale",
    questions: [
      {
        id: "q1",
        text: "I think that EduGate would improve my personal safety and the overall security of the campus.",
      },
      {
        id: "q2",
        text: "The system would save me time during entry compared to the current ID verification process.",
      },
      {
        id: "q3",
        text: "EduGate would effectively prevent unauthorized individuals from entering the campus.",
      },
      {
        id: "q4",
        text: "The automated attendance feature of EduGate would reduce administrative workload for teachers and staff.",
      },
      {
        id: "q5",
        text: "Overall, I believe EduGate would be a genuinely useful addition to the school's security infrastructure.",
      },
    ],
  },
  {
    code: "PEOU",
    title: "Part III · Perceived Ease of Use (PEOU)",
    responseFormat: "5-Point Likert Scale",
    questions: [
      { id: "q1", text: "The EduGate system is easy to understand." },
      { id: "q2", text: "It is easy to position myself for facial recognition." },
      {
        id: "q3",
        text: "The system works quickly without requiring much effort.",
      },
      { id: "q4", text: "I can use the system without assistance." },
      {
        id: "q5",
        text: "The instructions provided are clear and understandable.",
      },
    ],
  },
  {
    code: "ST",
    title: "Part IV · Security and Trust",
    responseFormat: "5-Point Likert Scale",
    questions: [
      { id: "q1", text: "I trust the system to accurately authorize individuals." },
      { id: "q2", text: "I believe the system protects personal data securely." },
      {
        id: "q3",
        text: "I am comfortable using facial recognition for campus entry.",
      },
      {
        id: "q4",
        text: "I believe the system can detect unauthorized individuals effectively.",
      },
      { id: "q5", text: "I feel safer knowing such a system is implemented." },
    ],
  },
  {
    code: "PE",
    title: "Part V · Performance Efficiency",
    responseFormat: "5-Point Likert Scale",
    questions: [
      { id: "q1", text: "The system responds quickly during entry." },
      { id: "q2", text: "The system does not cause delays during peak hours." },
      { id: "q3", text: "The system operates smoothly without lag." },
      { id: "q4", text: "The system works reliably even with many users." },
      { id: "q5", text: "The system performs consistently throughout the day." },
    ],
  },
  {
    code: "USAB",
    title: "Part VI · Usability (ISO 25010)",
    responseFormat: "5-Point Likert Scale",
    questions: [
      { id: "q1", text: "The system interface is easy to understand." },
      {
        id: "q2",
        text: "The system provides clear feedback (e.g., access granted/denied).",
      },
      { id: "q3", text: "The system is easy to operate." },
      {
        id: "q4",
        text: "Errors (e.g., unrecognized face) are clearly communicated.",
      },
      { id: "q5", text: "Overall, the system is user-friendly." },
    ],
  },
  {
    code: "BI",
    title: "Part VII · Behavioral Intention",
    responseFormat: "5-Point Likert Scale",
    questions: [
      { id: "q1", text: "I would be willing to use EduGate regularly." },
      { id: "q2", text: "I would recommend the system to others." },
      {
        id: "q3",
        text: "I support the implementation of EduGate in the school.",
      },
    ],
  },
];

