import { postToServerFunction } from "../lib/serverApi";

type GeoapifyFeatureCollection = {
  features: any[];
};

export async function fetchGeoapifyPlaces(input: {
  categories: string;
  lon: number;
  lat: number;
  radius: number;
  limit: number;
  bias?: string;
}) {
  return postToServerFunction<GeoapifyFeatureCollection>('geoapify-places', input);
}
