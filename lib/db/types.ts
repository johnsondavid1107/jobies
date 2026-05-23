export type Stage =
  | 'recommended'
  | 'interested'
  | 'saved'
  | 'applied'
  | 'response_received'
  | 'recruiter_screen'
  | 'first_round'
  | 'second_round'
  | 'final_round'
  | 'offer'
  | 'offer_accepted'
  | 'rejected'
  | 'ghosted';

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'interested', label: 'Interested' },
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'response_received', label: 'Response received' },
  { id: 'recruiter_screen', label: 'Recruiter screen' },
  { id: 'first_round', label: 'First round' },
  { id: 'second_round', label: 'Second round' },
  { id: 'final_round', label: 'Final round' },
  { id: 'offer', label: 'Offer' },
  { id: 'offer_accepted', label: 'Offer accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'ghosted', label: 'Ghosted' },
];

export type SwipeAction = 'interested' | 'rejected' | 'save_for_later' | 'already_applied';

export interface ScoringWeights {
  resume: number;
  title: number;
  industry: number;
  seniority: number;
  salary: number;
  location: number;
  swipe: number;
  quality: number;
}

export interface Preferences {
  allow_senior_titles: boolean;
  allow_stretch_roles: boolean;
  broaden_industries: boolean;
  strict_salary_floor: boolean;
  salary_floor: number;
  remote_only: boolean;
  exploration_mode: boolean;
  exclude_scams: boolean;
  preferred_titles: string[];
  preferred_industries: string[];
  preferred_locations: string[];
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  resume: 30, title: 15, industry: 10, seniority: 10,
  salary: 10, location: 10, swipe: 10, quality: 5,
};

export const DEFAULT_PREFERENCES: Preferences = {
  allow_senior_titles: true,
  allow_stretch_roles: true,
  broaden_industries: true,
  strict_salary_floor: false,
  salary_floor: 0,
  remote_only: false,
  exploration_mode: false,
  exclude_scams: true,
  preferred_titles: [],
  preferred_industries: [],
  preferred_locations: [],
};
