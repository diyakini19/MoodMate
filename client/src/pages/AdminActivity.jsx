import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AUDIT_ACTIONS,
  describeDevice,
  listAuditLogs,
} from "../services/auditService";
import { listUsers } from "../services/userService";
import { formatDateTime, toDate } from "../services/dateFormat";
import AdminHeader from "../components/AdminHeader";
import "./Admin.css";

function startOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function AdminActivity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uidFilter = searchParams.get("uid") || "";

  const [logs, setLogs] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [logData, userData] = await Promise.all([
          listAuditLogs({ uid: uidFilter }),
          listUsers(),
        ]);

        if (cancelled) {
          return;
        }

        setLogs(logData);
        setLoadedAt(Date.now());
        setUsersById(
          Object.fromEntries(userData.map((item) => [item.uid, item]))
        );
      } catch (loadError) {
        console.error("Admin activity error:", loadError);
        if (!cancelled) {
          setError(
            "Unable to load activity. Make sure the latest Firestore rules are deployed."
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
  }, [uidFilter, reloadKey]);

  const userLabel = (uid, fallback) => {
    const known = usersById[uid];
    return known?.username || known?.name || fallback || uid || "Unknown";
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [
        log.username,
        log.name,
        log.email,
        log.targetName,
        log.details,
        usersById[log.uid]?.username,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [logs, usersById, search, actionFilter]);

  const todayStats = useMemo(() => {
    const today = startOfDay(loadedAt);
    const todays = logs.filter(
      (log) => (toDate(log.createdAt)?.getTime() || 0) >= today
    );
    const logins = todays.filter((log) => log.action === "login");

    return {
      logins: logins.length,
      logouts: todays.filter((log) => log.action === "logout").length,
      signups: todays.filter((log) => log.action === "signup").length,
      uniqueUsers: new Set(logins.map((log) => log.uid)).size,
      blocked: todays.filter((log) => log.action === "login_blocked").length,
    };
  }, [logs, loadedAt]);

  const describeEvent = (log) => {
    const parts = [];

    if (log.method) {
      parts.push(log.method === "google" ? "via Google" : "with password");
    }

    if (log.targetUid) {
      parts.push(`user: ${userLabel(log.targetUid, log.targetName)}`);
    }

    if (log.details) {
      parts.push(log.details);
    }

    return parts.join(" · ") || "—";
  };

  const filteredUser = uidFilter ? usersById[uidFilter] : null;

  return (
    <div className="admin-page app-page">
      <AdminHeader active="/admin/activity" />

      <main className="admin-main app-page-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">AUDIT LOG</span>
            <h1>Activity</h1>
            <p>
              Sign-ups, logins, logouts, and admin actions. Showing the latest{" "}
              {logs.length} events.
            </p>
          </div>
        </header>

        {uidFilter && (
          <div className="admin-filter-chip">
            Showing activity for{" "}
            <strong>
              {filteredUser?.username || filteredUser?.name || uidFilter}
            </strong>
            <button type="button" onClick={() => setSearchParams({})}>
              Show everyone
            </button>
          </div>
        )}

        <section className="admin-stats-grid">
          <article className="admin-stat-card">
            <span>Logins today</span>
            <strong>{todayStats.logins}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Users active today</span>
            <strong>{todayStats.uniqueUsers}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Logouts today</span>
            <strong>{todayStats.logouts}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Sign-ups today</span>
            <strong>{todayStats.signups}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Blocked logins today</span>
            <strong>{todayStats.blocked}</strong>
          </article>
        </section>

        <section className="admin-card admin-toolbar">
          <input
            type="search"
            placeholder="Search by user, email, details..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          >
            <option value="">All events</option>
            {Object.entries(AUDIT_ACTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Refresh
          </button>
        </section>

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-card">
          {loading ? (
            <p>Loading activity...</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Event</th>
                    <th>Details</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>
                        <Link
                          to={`/admin/activity?uid=${encodeURIComponent(log.uid)}`}
                        >
                          {userLabel(log.uid, log.username || log.name || log.email)}
                        </Link>
                      </td>
                      <td>
                        <span className={`admin-badge action-${log.action}`}>
                          {AUDIT_ACTIONS[log.action] || log.action}
                        </span>
                      </td>
                      <td>{describeEvent(log)}</td>
                      <td className="admin-muted">
                        {describeDevice(log.userAgent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLogs.length === 0 && (
                <p className="admin-muted">No activity recorded yet.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminActivity;
