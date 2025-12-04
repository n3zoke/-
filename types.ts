export enum Genre {
  FANTASY = 'خيالي',
  ADVENTURE = 'مغامرة',
  SCIFI = 'خيال علمي',
  MYSTERY = 'غموض',
  BEDTIME = 'قصة ما قبل النوم',
  EDUCATIONAL = 'تعليمي',
  FOLKLORE = 'تراثي',
  HORROR = 'رعب',
  THRILLER = 'إثارة وتشويق',
  ROMANCE = 'رومانسي',
  DRAMA = 'دراما',
  CRIME = 'جريمة',
  PSYCHOLOGICAL = 'نفسي',
  HISTORICAL = 'تاريخي',
  ADULT_ROMANCE = 'رومانسية جريئة (للكبار)',
}

export enum AgeGroup {
  TODDLER = '3-5 سنوات',
  CHILD = '6-9 سنوات',
  PRETEEN = '10-13 سنة',
  TEEN = '14-17 سنة',
  ADULT = 'للكبار (+18)',
}

export enum StoryLength {
  TIER_1 = 'قصيرة (1000 كلمة)',
  TIER_2 = 'متوسطة (5000 كلمة)',
  TIER_3 = 'طويلة (10000 كلمة)',
  TIER_4 = 'طويلة جداً (15000 كلمة)',
  TIER_5 = 'ملحمة روائية (20000 كلمة)',
}

export interface StoryParams {
  prompt: string;
  genre: Genre;
  ageGroup: AgeGroup;
  length: StoryLength;
  characterName?: string;
  language?: string; // Default 'Arabic'
}

export interface GeneratedStory {
  title: string;
  summary: string;
  content: string; // The full story content
  imagePrompt: string; // A prompt optimized for image generation
  moral?: string; // Optional moral of the story
}

export interface SavedStory {
  id: string;
  createdAt: number;
  story: GeneratedStory;
  imageSrc: string | null;
  bookmarks?: number[]; // indices of bookmarked paragraphs
}

export interface StoryState {
  isLoading: boolean;
  error: string | null;
  data: GeneratedStory | null;
  generatedImage: string | null; // Base64 image
  isGeneratingImage: boolean;
}