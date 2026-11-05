import { BrowserRouter, Routes, Route } from "react-router-dom";

// ================================
// PAGES
// ================================

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";

import Mood from "./pages/Mood";
import Group from "./pages/Group";
import Preferences from "./pages/Preferences";
import Midpoint from "./pages/Midpoint";

import PublicTransport from "./pages/PublicTransport";
import PrivateTransport from "./pages/PrivateTransport";

import Recommendations from "./pages/Recommendations";
import PlanDetail from "./pages/PlanDetail";
import SharedPlan from "./pages/SharedPlan";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminPlans from "./pages/AdminPlans";
import AdminActivity from "./pages/AdminActivity";

// ================================
// AUTH
// ================================

import ProtectedRoute from "./routes/ProtectedRoute";
import { PERMISSIONS } from "./rbac/roles";


function App() {

  return (

    <BrowserRouter>

      <Routes>


        {/* =================================================
            HOME
            PUBLIC
        ================================================= */}

        <Route
          path="/"
          element={<Home />}
        />


        {/* =================================================
            LOGIN
            PUBLIC
        ================================================= */}

        <Route
          path="/login"
          element={<Login />}
        />


        {/* =================================================
            SIGNUP
            PUBLIC
        ================================================= */}

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/p/:shareId"
          element={<SharedPlan />}
        />


        {/* =================================================
            DASHBOARD
            PROTECTED
        ================================================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            PROFILE
            PROTECTED
        ================================================= */}

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile/plan/:planId"
          element={
            <ProtectedRoute>
              <PlanDetail />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            MOODMATE PLAN FLOW
            ALL PROTECTED
        ================================================= */}


        {/* STEP 1
            MOOD
        */}

        <Route
          path="/mood"
          element={
            <ProtectedRoute>
              <Mood />
            </ProtectedRoute>
          }
        />


        {/* STEP 2
            GROUP
        */}

        <Route
          path="/group"
          element={
            <ProtectedRoute>
              <Group />
            </ProtectedRoute>
          }
        />


        {/* STEP 3
            PREFERENCES
        */}

        <Route
          path="/preferences"
          element={
            <ProtectedRoute>
              <Preferences />
            </ProtectedRoute>
          }
        />


        {/* STEP 4
            MIDPOINT
        */}

        <Route
          path="/midpoint"
          element={
            <ProtectedRoute>
              <Midpoint />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            TRANSPORT
            PROTECTED
        ================================================= */}


        {/* PUBLIC TRANSPORT */}

        <Route
          path="/public-transport"
          element={
            <ProtectedRoute>
              <PublicTransport />
            </ProtectedRoute>
          }
        />


        {/* PRIVATE TRANSPORT */}

        <Route
          path="/private-transport"
          element={
            <ProtectedRoute>
              <PrivateTransport />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            RECOMMENDATIONS
            PROTECTED
        ================================================= */}

        <Route
          path="/recommendations"
          element={
            <ProtectedRoute>
              <Recommendations />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            ADMIN PANEL
            ADMIN / MODERATOR
        ================================================= */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_ADMIN}>
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_USERS}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/plans"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_ALL_PLANS}>
              <AdminPlans />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/plans/:userId/:planId"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_ALL_PLANS}>
              <PlanDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/activity"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_AUDIT_LOGS}>
              <AdminActivity />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            FALLBACK
        ================================================= */}

        <Route
          path="*"
          element={<Home />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;