export type Visibility = "public" | "internal" | "restricted";

export interface Persona {
  id: string;
  name: string;
  role: string;
  initials: string;
  location: string;
  /** Visibility levels this person may read. */
  access: Visibility[];
  blurb: string;
  suggestions: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "workspace",
    name: "Workspace member",
    role: "Company workspace",
    initials: "WM",
    location: "Your company workspace",
    access: ["public", "internal", "restricted"],
    blurb: "Answers from the documents and policies available in your workspace.",
    suggestions: [
      "What are the most important company policies?",
      "Summarise the latest policy updates.",
      "Who can approve this request?", 
    ],
  },
  {
    id: "bob",
    name: "Bob",
    role: "People & HR",
    initials: "BB",
    location: "HR · People team",
    access: ["public", "internal", "restricted"],
    blurb: "Public and internal documents, plus HR-restricted policies.",
    suggestions: [
      "How much annual leave do I get?",
      "How does the compensation policy work?",
      "What is the parental leave allowance?",
    ],
  },
  {
    id: "carol",
    name: "Carol",
    role: "Finance",
    initials: "CR",
    location: "Finance · Controller",
    access: ["public", "internal", "restricted"],
    blurb: "Public and internal documents, plus finance-restricted policies.",
    suggestions: [
      "How do I submit a reimbursement?",
      "Who can approve a customer discount?",
      "What is the travel expense limit?",
    ],
  },
  {
    id: "guest",
    name: "Guest",
    role: "External",
    initials: "GU",
    location: "Outside the company",
    access: ["public"],
    blurb: "Public documents only. Internal and restricted policies stay invisible.",
    suggestions: [
      "What is the refund policy?",
      "What are the shipping options?",
      "What does the warranty cover?",
    ],
  },
];

export const VISIBILITY_ORDER: Visibility[] = ["public", "internal", "restricted"];
