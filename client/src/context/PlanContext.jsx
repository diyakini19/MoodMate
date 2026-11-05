/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

const PLAN_STORAGE_KEY = "moodmate-active-plan";

export const emptyPlan = {
  mood: "",
  memberCount: 2,
  locationMode: "together",
  travelMode: "public",
  currentLocation: "",
  members: [],
  budget: "",
  vibes: [],
  midpoint: null,
  startLocation: "",
  midpointName: "",
};

function loadPlan() {
  try {
    const raw = sessionStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) {
      return { ...emptyPlan };
    }

    return {
      ...emptyPlan,
      ...JSON.parse(raw),
    };
  } catch {
    return { ...emptyPlan };
  }
}

function persistPlan(plan) {
  sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
}

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [plan, setPlan] = useState(loadPlan);

  const updatePlan = useCallback((partial) => {
    setPlan((current) => {
      const next = {
        ...current,
        ...partial,
      };

      persistPlan(next);
      return next;
    });
  }, []);

  const resetPlan = useCallback(() => {
    const next = { ...emptyPlan };
    persistPlan(next);
    setPlan(next);
  }, []);

  return (
    <PlanContext.Provider
      value={{
        plan,
        updatePlan,
        resetPlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanContext);

  if (!context) {
    throw new Error("usePlan must be used inside PlanProvider");
  }

  return context;
}

export function useMergedPlan() {
  const location = useLocation();
  const { plan, updatePlan } = usePlan();
  const incoming = location.state;

  useEffect(() => {
    if (
      incoming &&
      typeof incoming === "object" &&
      Object.keys(incoming).length > 0
    ) {
      updatePlan(incoming);
    }
  }, [incoming, updatePlan]);

  return useMemo(
    () => ({
      ...plan,
      ...(incoming && typeof incoming === "object" ? incoming : {}),
    }),
    [plan, incoming]
  );
}
