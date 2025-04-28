export interface PictureSet {
  id: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  cover_image_url: string;
  description: string;
  title: string;
  subtitle: string;
  pictures: Picture[];
}

export interface Picture {
  id: number;
  picture_set_id: number;
  order_index: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  raw_image_url: string;
  image_url: string;
  title: string;
  subtitle: string;
  description: string;
}
