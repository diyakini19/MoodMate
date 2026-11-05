import { useState } from "react";
import {
  createSharedPlan,
  getQrImageUrl,
  getShareUrl,
} from "../services/shareService";
import {
  buildGoogleCalendarUrl,
  downloadPlanIcs,
} from "../services/calendarExport";
import {
  openWhatsAppShare,
  sharePlanWithFriends,
} from "../services/notifyShare";
import { toggleFavoritePlan } from "../services/planService";
import "./PlanActions.css";

function PlanActions({
  plan,
  user,
  onPlanUpdate,
  showFavorite = true,
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState(
    plan?.shareId ? getShareUrl(plan.shareId) : ""
  );
  const [showQr, setShowQr] = useState(false);

  const setStatus = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  };

  const ensureShareLink = async () => {
    if (shareUrl) {
      return shareUrl;
    }

    if (!user) {
      throw new Error("Login to create a share link.");
    }

    setBusy("share");
    const shared = await createSharedPlan(user, plan);
    const url = shared.shareUrl;
    setShareUrl(url);
    onPlanUpdate?.({
      ...plan,
      shareId: shared.id,
    });
    return url;
  };

  const handleShareLink = async () => {
    try {
      const url = await ensureShareLink();
      await navigator.clipboard?.writeText(url);
      setShowQr(true);
      setStatus("Share link copied.");
    } catch (error) {
      setStatus(error.message || "Unable to create share link.");
    } finally {
      setBusy("");
    }
  };

  const handleNotify = async () => {
    try {
      setBusy("notify");
      const url = shareUrl || (user ? await ensureShareLink() : "");
      const result = await sharePlanWithFriends(plan, url);
      setStatus(
        result.method === "native"
          ? "Share sheet opened."
          : "Invite text copied."
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        setStatus(error.message || "Unable to share.");
      }
    } finally {
      setBusy("");
    }
  };

  const handleWhatsApp = async () => {
    try {
      setBusy("whatsapp");
      const url = shareUrl || (user ? await ensureShareLink() : "");
      openWhatsAppShare(plan, url);
    } catch (error) {
      setStatus(error.message || "Unable to open WhatsApp.");
    } finally {
      setBusy("");
    }
  };

  const handleFavorite = async () => {
    if (!user || !plan?.id) {
      setStatus("Save the plan first to favorite it.");
      return;
    }

    try {
      setBusy("favorite");
      const next = !plan.favorite;
      await toggleFavoritePlan(user.uid, plan.id, next);
      onPlanUpdate?.({
        ...plan,
        favorite: next,
      });
      setStatus(next ? "Added to favorites." : "Removed from favorites.");
    } catch (error) {
      setStatus(error.message || "Unable to update favorite.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="plan-actions">
      <div className="plan-actions-row">
        <button
          type="button"
          className="plan-action-btn"
          disabled={Boolean(busy)}
          onClick={handleShareLink}
        >
          {busy === "share" ? "Creating..." : "Share link / QR"}
        </button>

        <button
          type="button"
          className="plan-action-btn secondary"
          disabled={Boolean(busy)}
          onClick={handleNotify}
        >
          Notify friends
        </button>

        <button
          type="button"
          className="plan-action-btn secondary"
          disabled={Boolean(busy)}
          onClick={handleWhatsApp}
        >
          WhatsApp
        </button>

        <button
          type="button"
          className="plan-action-btn secondary"
          onClick={() => downloadPlanIcs(plan)}
        >
          Download .ics
        </button>

        <button
          type="button"
          className="plan-action-btn secondary"
          onClick={() =>
            window.open(
              buildGoogleCalendarUrl(plan),
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          Google Calendar
        </button>

        {showFavorite && (
          <button
            type="button"
            className={`plan-action-btn ${plan?.favorite ? "" : "secondary"}`}
            disabled={Boolean(busy) || !plan?.id}
            onClick={handleFavorite}
          >
            {plan?.favorite ? "★ Favorited" : "☆ Favorite"}
          </button>
        )}
      </div>

      {message && <p className="plan-actions-message">{message}</p>}

      {shareUrl && (
        <div className="plan-share-box">
          <p className="plan-share-url">{shareUrl}</p>
          {showQr && (
            <img
              className="plan-share-qr"
              src={getQrImageUrl(shareUrl)}
              alt="QR code for shared MoodMate plan"
            />
          )}
        </div>
      )}
    </section>
  );
}

export default PlanActions;
