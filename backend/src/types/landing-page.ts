export interface LandingPage {
  id: number;
  title: string;
  description: string | null;
  keywords: string;
  url: string;
  data_lp: string | Date | null;
}

export interface CreateLandingPageDTO {
  title: string;
  description?: string | null;
  keywords: string;
  url: string;
  data_lp?: string | null;
}

export type UpdateLandingPageDTO = Partial<CreateLandingPageDTO>;
