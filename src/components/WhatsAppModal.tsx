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
    openModal: (policy: WhatsAppModalProps) => setSelectedPolicy(policy),
    closeModal: () => setSelectedPolicy(null),
  };
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
  const [message, setMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountryIso2, setSelectedCountryIso2] =
    useState(DEFAULT_COUNTRY_ISO2);
  const [isSending, setIsSending] = useState(false);

  const sortedCountryCodes = useMemo(
    () =>
      [...COUNTRY_CALLING_CODES].sort(
        (a, b) => b.dialCode.length - a.dialCode.length
      ),
    []
  );

  const selectedCountry =
    COUNTRY_CALLING_CODES.find((country) => country.iso2 === selectedCountryIso2)
    ?? COUNTRY_CALLING_CODES[0];

  useEffect(() => {
    if (!isOpen || !policy) {
      return;
    }

    const defaultMessage = `Hello ${policy.customerName}, your ${policy.policyType} policy is expiring soon. Please contact us for a renewal.`;
    const cleanedPhone = policy.phone.replace(/\D/g, "");

    let nextCountryIso2 = DEFAULT_COUNTRY_ISO2;
    let nextPhoneNumber = cleanedPhone;

    if (cleanedPhone.length > 10) {
      const matchedCountry = sortedCountryCodes.find(
        (country) =>
          cleanedPhone.startsWith(country.dialCode) &&
          cleanedPhone.length > country.dialCode.length
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
    setMessage("");
    setPhoneNumber("");
    setSelectedCountryIso2(DEFAULT_COUNTRY_ISO2);
    setIsSending(false);
    onClose();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!policy || !message.trim() || !phoneNumber.trim()) {
      return;
    }

    setIsSending(true);

    try {
      const cleanedPhone = phoneNumber.replace(/\D/g, "");
      const finalPhone = `${selectedCountry.dialCode}${cleanedPhone}`;

      const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, "_blank");

      setTimeout(() => {
        handleClose();
      }, 500);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      setIsSending(false);
    }
  };

  if (!isOpen || !policy) return null;

  return (
    <div className="confirm-overlay" onClick={handleClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: "var(--primary)", marginBottom: "16px" }}>
          WhatsApp Reminder
        </h3>

        <form
          onSubmit={handleSend}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* Recipient */}
          <div className="form-group">
            <label className="form-label">Recipient</label>
            <div
              style={{
                padding: "10px 13px",
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                fontSize: "13.5px",
              }}
            >
              {policy.customerName}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">WhatsApp Number</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(130px, 180px) minmax(0, 1fr)",
                gap: "10px",
              }}
            >
              <select
                className="form-control"
                value={selectedCountryIso2}
                onChange={(e) => setSelectedCountryIso2(e.target.value)}
                disabled={isSending}
              >
                {COUNTRY_CALLING_CODES.map((country) => (
                  <option key={country.iso2} value={country.iso2}>
                    {country.name} (+{country.dialCode})
                  </option>
                ))}
              </select>
              <input
                className="form-control"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter WhatsApp number"
                disabled={isSending}
              />
            </div>
          </div>

          {/* Message */}
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              className="form-control"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message"
              disabled={isSending}
              style={{ minHeight: "100px" }}
            />
            <div
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                marginTop: "4px",
                textAlign: "right",
              }}
            >
              {message.length} / 4096 characters
            </div>
          </div>

          {/* Actions */}
          <div className="confirm-actions" style={{ marginTop: "8px" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSending}
              className="btn btn-sm btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || !message.trim() || !phoneNumber.trim()}
              className="btn btn-sm"
              style={{
                flex: 1,
                background: "#25D366",
                color: "#fff",
                border: "none",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                if (!(e.currentTarget as HTMLButtonElement).disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#20ba5e";
                }
              }}
              onMouseLeave={(e) => {
                if (!(e.currentTarget as HTMLButtonElement).disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#25D366";
                }
              }}
            >
              {isSending ? "Sending..." : "Send via WhatsApp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
