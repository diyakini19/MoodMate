import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAllPlans } from "../services/planService";
import { listUsers } from "../services/userService";
import { formatDateTime, toDate } from "../services/dateFormat";
import AdminHeader from "../components/AdminHeader";
import "./Admin.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function AdminPlans() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uidFilter = searchParams.get("uid") || "";

  const [plans, setPlans] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [planData, userData] = await Promise.all([
          listAllPlans(),
          listUsers(),
        ]);

        if (cancelled) {
          return;
        }

        setPlans(planData);
        setLoadedAt(Date.now());
        setUsersById(
          Object.fromEntries(userData.map((item) => [item.uid, item]))
        );
      } catch (loadError) {
        console.error("Admin plans error:", loadError);
        if (!cancelled) {
          setError(
            "Unable to load plans. Make sure the latest Firestore rules are deployed."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const ownerLabel = (plan) => {
    const owner = usersById[plan.ownerId];
    return (
      owner?.username ||
      owner?.name ||
      plan.userName ||
      plan.userEmail ||
      plan.ownerId ||
      "Unknown"
    );
  };

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLowerCase();

    return plans.filter((plan) => {
      if (uidFilter && plan.ownerId !== uidFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      const owner = usersById[plan.ownerId];
      return [
        owner?.username,
        owner?.name,
        plan.userName,
        plan.userEmail,
        plan.mood,
        plan.travelMode,
        plan.midpoint?.name,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [plans, usersById, search, uidFilter]);

  const stats = useMemo(() => {
    const weekAgo = loadedAt - WEEK_MS;
    const moodCounts = {};

    filteredPlans.forEach((plan) => {
      if (plan.mood) {
        moodCounts[plan.mood] = (moodCounts[plan.mood] || 0) + 1;
      }
    });

    const topMood =
      Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    return {
      total: filteredPlans.length,
      thisWeek: filteredPlans.filter(
        (plan) => (toDate(plan.createdAt)?.getTime() || 0) >= weekAgo
      ).length,
      shared: filteredPlans.filter((plan) => plan.shareId).length,
      creators: new Set(filteredPlans.map((plan) => plan.ownerId)).size,
      topMood,
    };
  }, [filteredPlans, loadedAt]);

  const filteredUser = uidFilter ? usersById[uidFilter] : null;

  return (
    <div className="admin-page app-page">
      <AdminHeader active="/admin/plans" />

      <main className="admin-main app-page-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">ALL USERS</span>
            <h1>Plans</h1>
            <p>Every plan saved by MoodMate users, newest first.</p>
          </div>
        </header>

        {uidFilter && (
          <div className="admin-filter-chip">
            Showing plans by{" "}
            <strong>
              {filteredUser?.username || filteredUser?.name || uidFilter}
            </strong>
            <button type="button" onClick={() => setSearchParams({})}>
              Show all users
            </button>
          </div>
        )}

        <section className="admin-stats-grid">
          <article className="admin-stat-card">
            <span>Plans</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Last 7 days</span>
            <strong>{stats.thisWeek}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Shared</span>
            <strong>{stats.shared}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Creators</span>
            <strong>{stats.creators}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Top mood</span>
            <strong className="admin-stat-text">{stats.topMood}</strong>
          </article>
        </section>

        <section className="admin-card admin-toolbar">
          <input
            type="search"
            placeholder="Search by user, mood, meeting point..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Refresh
          </button>
        </section>

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-card">
          {loading ? (
            <p>Loading plans...</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>User</th>
                    <th>Mood</th>
                    <th>People</th>
                    <th>Travel</th>
                    <th>Meeting point</th>
                    <th>Places</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr key={`${plan.ownerId}-${plan.id}`}>
                      <td>{formatDateTime(plan.createdAt)}</td>
                      <td>
                        <Link
                          to={`/admin/plans?uid=${encodeURIComponent(plan.ownerId)}`}
                        >
                          {ownerLabel(plan)}
                        </Link>
                      </td>
                      <td className="admin-capitalize">{plan.mood || "—"}</td>
                      <td>
                        {plan.memberCount ||
                          (Array.isArray(plan.members) ? plan.members.length : 0)}
                      </td>
                      <td className="admin-capitalize">
                        {plan.travelMode || "—"}
                      </td>
                      <td>{plan.midpoint?.name || "—"}</td>
                      <td>
                        {Array.isArray(plan.places) ? plan.places.length : 0}
                        {plan.shareId ? (
                          <span className="admin-badge status-active admin-badge-gap">
                            shared
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <Link
                          className="admin-action-btn secondary admin-link-btn"
                          to={`/admin/plans/${plan.ownerId}/${plan.id}`}
                          state={{ plan }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredPlans.length === 0 && (
                <p className="admin-muted">No plans found.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminPlans;
