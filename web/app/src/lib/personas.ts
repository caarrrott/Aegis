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
    id: "alice",
    name: "Alice",
    role: "Engineering",
    initials: "AL",
    location: "Engineering · Staff",
    access: ["public", "internal", "restricted"],
    blurb: "Public and internal documents, plus engineering-restricted policies.",
    suggestions: [
      "What does error code E-1042 mean?",
      "Summarise the security policy.",
      "Who can approve production access?",
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
