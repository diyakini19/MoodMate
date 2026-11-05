import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";

export function getShareUrl(shareId) {
  if (typeof window === "undefined" || !shareId) {
    return "";
  }

  return `${window.location.origin}/p/${shareId}`;
}

export function getQrImageUrl(shareUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    shareUrl
  )}`;
}

export async function createSharedPlan(user, plan) {
  if (!user?.uid) {
    throw new Error("Login required to share a plan.");
  }

  const payload = {
    ownerId: user.uid,
    ownerName: user.displayName || user.email || "MoodMate host",
    ownerPlanId: plan.id || "",
    mood: plan.mood || "",
    memberCount: plan.memberCount || 0,
    travelMode: plan.travelMode || "",
    budget: plan.budget || "",
    vibes: Array.isArray(plan.vibes) ? plan.vibes : [],
    midpoint: plan.midpoint || null,
    members: Array.isArray(plan.members) ? plan.members : [],
    places: Array.isArray(plan.places) ? plan.places : [],
    itinerary: plan.itinerary || null,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "sharedPlans"), payload);

  if (plan.id) {
    try {
      await updateDoc(doc(db, "users", user.uid, "plans", plan.id), {
        shareId: ref.id,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("Unable to attach shareId to saved plan:", error);
    }
  }

  return {
    id: ref.id,
    ...payload,
    shareUrl: getShareUrl(ref.id),
  };
}

export async function getSharedPlan(shareId) {
  const snapshot = await getDoc(doc(db, "sharedPlans", shareId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}
