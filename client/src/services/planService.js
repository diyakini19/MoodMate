import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import { incrementUserPlanCount } from "./userService";

function cleanMembers(planData) {
  return Array.isArray(planData.members)
    ? planData.members.map((member) => ({
        name: member?.name || "",
        location: member?.location || "",
        lat: member?.lat != null ? Number(member.lat) : null,
        lng: member?.lng != null ? Number(member.lng) : null,
      }))
    : [];
}

function cleanMidpoint(planData) {
  if (!planData.midpoint) {
    return null;
  }

  return {
    name: planData.midpoint.name || "",
    lat:
      planData.midpoint.lat != null
        ? Number(planData.midpoint.lat)
        : null,
    lng:
      planData.midpoint.lng != null
        ? Number(planData.midpoint.lng)
        : null,
    weather: planData.midpoint.weather || null,
  };
}

function cleanPlaces(planData) {
  return Array.isArray(planData.places)
    ? planData.places.map((place) => ({
        id: place?.id || "",
        name: place?.name || "",
        address: place?.address || "",
        category: place?.category || "",
        distance:
          place?.distance != null ? Number(place.distance) : null,
        lat: place?.lat != null ? Number(place.lat) : null,
        lng: place?.lng != null ? Number(place.lng) : null,
      }))
    : [];
}

function cleanItinerary(planData) {
  const itinerary = planData.itinerary;

  if (!itinerary || !Array.isArray(itinerary.stops) || !itinerary.stops.length) {
    return null;
  }

  return {
    startTime: itinerary.startTime || "",
    stops: itinerary.stops.map((stop) => ({
      kind: stop?.kind || "",
      label: stop?.label || "",
      category: stop?.category || "",
      name: stop?.name || "",
      address: stop?.address || "",
      lat: stop?.lat != null ? Number(stop.lat) : null,
      lng: stop?.lng != null ? Number(stop.lng) : null,
      distanceKm: Number(stop?.distanceKm) || 0,
      startsAt: stop?.startsAt || "",
      endsAt: stop?.endsAt || "",
    })),
  };
}

export function buildPlanPayload(user, planData) {
  const members = cleanMembers(planData);
  const places = cleanPlaces(planData);

  return {
    mood: planData.mood || "",
    memberCount:
      planData.memberCount != null
        ? Number(planData.memberCount)
        : members.length,
    locationMode: planData.locationMode || "",
    travelMode: planData.travelMode || "",
    currentLocation: planData.currentLocation || "",
    members,
    budget: planData.budget != null ? planData.budget : "",
    vibes: Array.isArray(planData.vibes) ? planData.vibes : [],
    midpoint: cleanMidpoint(planData),
    places,
    itinerary: cleanItinerary(planData),
    favorite: Boolean(planData.favorite),
    shareId: planData.shareId || "",
    createdAt: serverTimestamp(),
    userId: user.uid,
    userEmail: user.email || "",
    userName: user.displayName || "",
  };
}

export const savePlan = async (user, planData) => {
  if (!user?.uid) {
    throw new Error("User is not logged in.");
  }

  if (!planData) {
    throw new Error("No plan data provided.");
  }

  const completePlan = buildPlanPayload(user, planData);
  const plansRef = collection(db, "users", user.uid, "plans");
  const documentReference = await addDoc(plansRef, completePlan);

  try {
    await incrementUserPlanCount(user.uid);
  } catch (countError) {
    console.warn("Unable to update plan count:", countError);
  }

  return {
    id: documentReference.id,
    ...completePlan,
  };
};

export const updateSavedPlan = async (userId, planId, updates) => {
  if (!userId || !planId) {
    throw new Error("Missing plan id.");
  }

  await updateDoc(doc(db, "users", userId, "plans", planId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const toggleFavoritePlan = async (userId, planId, favorite) => {
  await updateSavedPlan(userId, planId, { favorite: Boolean(favorite) });
};

export const getSavedPlan = async (userId, planId) => {
  const snapshot = await getDoc(doc(db, "users", userId, "plans", planId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

export const listAllPlans = async () => {
  const snapshot = await getDocs(collectionGroup(db, "plans"));

  const plans = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
    ownerId: docSnap.ref.parent.parent?.id || docSnap.data().userId || "",
  }));

  plans.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || new Date(0);
    return dateB - dateA;
  });

  return plans;
};

export function planToFlowState(plan) {
  return {
    mood: plan.mood || "",
    memberCount: plan.memberCount || 2,
    locationMode: plan.locationMode || "together",
    travelMode: plan.travelMode || "public",
    currentLocation: plan.currentLocation || "",
    members: Array.isArray(plan.members) ? plan.members : [],
    budget: plan.budget || "",
    vibes: Array.isArray(plan.vibes) ? plan.vibes : [],
    midpoint: plan.midpoint || null,
    startLocation: plan.currentLocation || "",
    midpointName: plan.midpoint?.name || "",
  };
}
