"use client";

import { useState, useEffect } from "react";
import { User, Shield, Moon, Save, CheckCircle } from "lucide-react";

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  
  // Profile state
  const [profile, setProfile] = useState({
    name: "", phone: "", agencyName: "", licenseNumber: "",
    email: "", subscriptionTier: "", subscriptionStatus: "", createdAt: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "", newPassword: "", confirmPassword: ""
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Preferences state
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    fetchProfile();
    const theme = localStorage.getItem("theme");
    setIsDarkMode(theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/settings/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          agencyName: profile.agencyName,
          licenseNumber: profile.licenseNumber
        })
      });
      if (res.ok) {
        setProfileMessage("Profile updated successfully");
        setTimeout(() => setProfileMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage("Password updated successfully");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setPasswordMessage(""), 3000);
      } else {
        setPasswordError(data.error || "Failed to update password");
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred");
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
    // Dispatch custom event if other components need to know
    window.dispatchEvent(new Event("theme-change"));
  };

  if (loading) return <div style={{ padding: 20 }}>Loading settings...</div>;

  return (
    <div>
      <div className="topbar" style={{ position: "relative", top: 0, padding: 0, height: "auto", border: "none", boxShadow: "none", marginBottom: 20, background: "transparent" }}>
        <div className="topbar-left">
          <h2>Settings</h2>
          <p>Manage your account settings and preferences</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Sidebar Tabs */}
        <div className="card" style={{ width: 240, padding: 8 }}>
          <button
            onClick={() => setActiveTab("profile")}
            className={`nav-link ${activeTab === "profile" ? "active" : ""}`}
            style={{ width: "100%", justifyContent: "flex-start", background: activeTab === "profile" ? "var(--primary-light)" : "transparent", color: activeTab === "profile" ? "var(--primary)" : "inherit" }}
          >
            <User size={16} /> Profile
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`nav-link ${activeTab === "security" ? "active" : ""}`}
            style={{ width: "100%", justifyContent: "flex-start", background: activeTab === "security" ? "var(--primary-light)" : "transparent", color: activeTab === "security" ? "var(--primary)" : "inherit" }}
          >
            <Shield size={16} /> Security
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`nav-link ${activeTab === "preferences" ? "active" : ""}`}
            style={{ width: "100%", justifyContent: "flex-start", background: activeTab === "preferences" ? "var(--primary-light)" : "transparent", color: activeTab === "preferences" ? "var(--primary)" : "inherit" }}
          >
            <Moon size={16} /> Preferences
          </button>
        </div>

        {/* Content Area */}
        <div className="card" style={{ flex: 1 }}>
          {activeTab === "profile" && (
            <div>
              <div className="card-header">
                <span className="card-title">Profile Information</span>
              </div>
              <div className="card-body">
                <form onSubmit={handleProfileSave} className="form-grid-2">
                  <div className="form-group full-width" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge badge-active">{profile.subscriptionTier.toUpperCase()} PLAN</span>
                      <span className="badge" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                        {profile.subscriptionStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="form-group full-width">
                    <label className="form-label">Email Address (Read-only)</label>
                    <input type="email" className="form-control" value={profile.email} disabled style={{ background: "var(--bg)" }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input type="text" className="form-control" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number <span className="required">*</span></label>
                    <input type="tel" className="form-control" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Agency Name <span className="required">*</span></label>
                    <input type="text" className="form-control" value={profile.agencyName} onChange={e => setProfile({...profile, agencyName: e.target.value})} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">License Number</label>
                    <input type="text" className="form-control" value={profile.licenseNumber || ""} onChange={e => setProfile({...profile, licenseNumber: e.target.value})} />
                  </div>

                  <div className="form-group full-width" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      {profileMessage && <span style={{ color: "var(--status-active)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={14} /> {profileMessage}</span>}
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                      <Save size={16} /> {savingProfile ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <div className="card-header">
                <span className="card-title">Security Settings</span>
              </div>
              <div className="card-body">
                <form onSubmit={handlePasswordSave} style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Current Password <span className="required">*</span></label>
                    <input type="password" className="form-control" value={passwordData.currentPassword} onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password <span className="required">*</span></label>
                    <input type="password" className="form-control" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} required minLength={6} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm New Password <span className="required">*</span></label>
                    <input type="password" className="form-control" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} required minLength={6} />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    {passwordError && <div className="alert alert-danger" style={{ padding: "8px 12px", marginBottom: 12 }}>{passwordError}</div>}
                    {passwordMessage && <div className="alert" style={{ background: "var(--status-active-bg)", color: "var(--status-active)", border: "1px solid #a7e3be", padding: "8px 12px", marginBottom: 12 }}>{passwordMessage}</div>}
                    
                    <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                      <Shield size={16} /> {savingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div>
              <div className="card-header">
                <span className="card-title">Preferences</span>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                  <div>
                    <h4 style={{ fontSize: 14, marginBottom: 4 }}>Dark Mode</h4>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Switch between light and dark theme</p>
                  </div>
                  <button 
                    type="button"
                    onClick={toggleDarkMode}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: isDarkMode ? "var(--primary)" : "var(--border)",
                      position: "relative",
                      border: "none", cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3, left: isDarkMode ? 23 : 3,
                      transition: "left 0.2s"
                    }} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
