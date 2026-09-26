"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_ISO2,
} from "@/lib/countryCallingCodes";

export interface WhatsAppModalProps {
  customerName: string;
  phone: string;
  policyNumber: string;
  policyType: string;
  endDate: string;
}

export function useWhatsAppModal() {
  const [selectedPolicy, setSelectedPolicy] =
    useState<WhatsAppModalProps | null>(null);

  return {
    selectedPolicy,
    setSelectedPolicy,
    openModal:  (policy: WhatsAppModalProps) => setSelectedPolicy(policy),
    closeModal: () => setSelectedPolicy(null),
  };
}

/** WhatsApp SVG logo */
function WaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  policy,
}: {
  isOpen: boolean;
  onClose: () => void;
  policy: WhatsAppModalProps | null;
}) {
  const [message,             setMessage]             = useState("");
  const [phoneNumber,         setPhoneNumber]         = useState("");
  const [selectedCountryIso2, setSelectedCountryIso2] = useState(DEFAULT_COUNTRY_ISO2);
  const [isSending,           setIsSending]           = useState(false);

  const sortedCountryCodes = useMemo(
    () => [...COUNTRY_CALLING_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length),
    []
  );

  const selectedCountry =
    COUNTRY_CALLING_CODES.find(c => c.iso2 === selectedCountryIso2) ?? COUNTRY_CALLING_CODES[0];

  useEffect(() => {
    if (!isOpen || !policy) return;

    const defaultMessage =
      `Hello ${policy.customerName},\n\nYour *${policy.policyType}* insurance policy (${policy.policyNumber}) is expiring on *${policy.endDate}*.\n\nPlease contact us to renew your policy and ensure continued coverage.\n\nThank you! 🙏`;

    const cleanedPhone = policy.phone.replace(/\D/g, "");
    let nextCountryIso2 = DEFAULT_COUNTRY_ISO2;
    let nextPhoneNumber = cleanedPhone;

    if (cleanedPhone.length > 10) {
      const matchedCountry = sortedCountryCodes.find(
        c => cleanedPhone.startsWith(c.dialCode) && cleanedPhone.length > c.dialCode.length
      );
      if (matchedCountry) {
        nextCountryIso2 = matchedCountry.iso2;
        nextPhoneNumber = cleanedPhone.slice(matchedCountry.dialCode.length);
      }
    }

    setMessage(defaultMessage);
    setSelectedCountryIso2(nextCountryIso2);
    setPhoneNumber(nextPhoneNumber);
  }, [isOpen, policy, sortedCountryCodes]);

  const handleClose = () => {
    setMessage(""); setPhoneNumber(""); setSelectedCountryIso2(DEFAULT_COUNTRY_ISO2); setIsSending(false);
    onClose();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy || !message.trim() || !phoneNumber.trim()) return;
    setIsSending(true);
    try {
      const cleaned   = phoneNumber.replace(/\D/g, "");
      const finalPhone = `${selectedCountry.dialCode}${cleaned}`;
      window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, "_blank");
      setTimeout(handleClose, 500);
    } catch {
      setIsSending(false);
    }
  };

  if (!isOpen || !policy) return null;

  /** Render *bold* and line-breaks in the preview */
  function renderPreview(text: string) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      return (
        <span key={i}>
          {parts.map((p, j) =>
            p.startsWith("*") && p.endsWith("*")
              ? <strong key={j}>{p.slice(1, -1)}</strong>
              : p
          )}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div className="confirm-overlay" onClick={handleClose}>
      <div
        className="whatsapp-modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-xl)",
          width: "min(900px, 95vw)",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
          animation: "slideUp .2s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-light)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#25D366",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
        }}>
          <WaIcon size={22} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>WhatsApp Reminder</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>
              {policy.customerName} · {policy.policyType} · Expires {policy.endDate}
            </div>
          </div>
        </div>

        {/* Body — two-column on desktop */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          flex: 1,
          overflow: "hidden",
        }} className="wa-modal-body">
          {/* ── Left: Form ── */}
          <form
            onSubmit={handleSend}
            style={{
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              overflowY: "auto",
              borderRight: "1px solid var(--border-light)",
            }}
          >
            {/* Recipient */}
            <div className="form-group">
              <label className="form-label">Recipient</label>
              <div style={{
                padding: "10px 13px",
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13.5,
                color: "var(--text)",
              }}>
                {policy.customerName}
              </div>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 160px) 1fr", gap: 8 }}>
                <select
                  className="form-control"
                  value={selectedCountryIso2}
                  onChange={e => setSelectedCountryIso2(e.target.value)}
                  disabled={isSending}
                >
                  {COUNTRY_CALLING_CODES.map(c => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.name} (+{c.dialCode})
                    </option>
                  ))}
                </select>
                <input
                  className="form-control"
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="Phone number"
                  disabled={isSending}
                />
              </div>
            </div>

            {/* Message */}
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">
                Message
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                  {message.length} / 4096
                </span>
              </label>
              <textarea
                className="form-control"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message here…"
                disabled={isSending}
                style={{ minHeight: 160, resize: "vertical" }}
              />
              <div className="form-hint">
                Use *text* for <strong>bold</strong> in WhatsApp
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSending}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending || !message.trim() || !phoneNumber.trim()}
                className="btn"
                style={{
                  flex: 1,
                  background: "#25D366",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <WaIcon size={15} />
                {isSending ? "Opening…" : "Send via WhatsApp"}
              </button>
            </div>
          </form>

          {/* ── Right: Live Preview ── */}
          <div style={{
            background: "#e5ddd5",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            overflowY: "auto",
            gap: 8,
          }}>
            {/* Preview label */}
            <div style={{ fontSize: 11, color: "rgba(0,0,0,.4)", textAlign: "center", marginBottom: 4 }}>
              Message preview
            </div>

            {/* Bubble */}
            <div style={{
              background: "#dcf8c6",
              borderRadius: "12px 12px 2px 12px",
              padding: "10px 13px",
              maxWidth: "88%",
              alignSelf: "flex-end",
              boxShadow: "0 1px 3px rgba(0,0,0,.12)",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "#111",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {message ? renderPreview(message) : (
                <span style={{ color: "rgba(0,0,0,.35)", fontStyle: "italic" }}>
                  Start typing to see preview…
                </span>
              )}
              <div style={{
                fontSize: 11,
                color: "rgba(0,0,0,.4)",
                textAlign: "right",
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 3,
              }}>
                {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                  <path d="M.5 5.5l3 3 5-5M5.5 8.5l3-3 3.5 3.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .wa-modal-body { grid-template-columns: 1fr !important; }
          .wa-modal-body > div:last-child { display: none; }
        }
      `}} />
    </div>
  );
}
