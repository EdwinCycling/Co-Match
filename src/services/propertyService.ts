import { postToServerFunction } from '../lib/serverApi';


type PropertyWriteResponse<T = undefined> = {
  ok: boolean;
  id?: string;
  property?: T;
  monthlyAvailability?: Record<string, string>;
  highlightWeeks?: string[];
  maxInquiries?: number;
  results?: Array<{
    propertyId: string;
    monthlyAvailability: Record<string, string>;
  }>;
};

export async function createProperty() {
  return postToServerFunction<PropertyWriteResponse<Record<string, unknown>>>('property-writes', {
    action: 'create-property',
  });
}

export async function duplicateProperty(property: Record<string, unknown>) {
  return postToServerFunction<PropertyWriteResponse<Record<string, unknown>>>('property-writes', {
    action: 'duplicate-property',
    property,
  });
}

export async function updateProperty(propertyId: string, property: Record<string, unknown>) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'update-property',
    propertyId,
    property,
  });
}

export async function deleteProperty(propertyId: string) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'delete-property',
    propertyId,
  });
}

export async function reactivateProperty(propertyId: string) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'reactivate-property',
    propertyId,
  });
}

export async function increasePropertyLimit(propertyId: string) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'increase-property-limit',
    propertyId,
  });
}

export async function updatePropertyAvailability(propertyId: string, monthKey: string, status: string) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'update-availability',
    propertyId,
    monthKey,
    status,
  });
}

export async function batchUpdatePropertyAvailability(propertyIds: string[], monthKey: string, status: string) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'batch-update-availability',
    propertyIds,
    monthKey,
    status,
  });
}

export async function addPropertyHighlightWeek(propertyId: string, weekId: string) {
  return postToServerFunction<PropertyWriteResponse>('property-writes', {
    action: 'add-highlight-week',
    propertyId,
    weekId,
  });
}
