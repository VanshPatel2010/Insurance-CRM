"use client";

import { useState, useCallback } from "react";
import { formatDate } from "@/lib/utils";
import {
  Search,
  Edit2,
  Save,
  X,
  Shield,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  Pause,
} from "lucide-react";

interface Agent {
  _id: string;
  name: string;
  email: string;
  agencyName: string;
  phone: string;
  licenseNumber: string | null;
  subscriptionStatus: "active" | "inactive" | "suspended" | "trial";
  subscriptionTier: "free" | "basic" | "premium" | "enterprise";
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  isAdmin: boolean;
  createdAt: string;
}

const statusConfig = {
  active: { label: "Active", color: "var(--status-active)" },
  inactive: { label: "Inactive", color: "var(--text-muted)" },
  trial: { label: "Trial", color: "var(--fire)" },
  suspended: { label: "Suspended", color: "var(--status-expired)" },
};

export default function AgentsManagementClient({
  initialAgents,
}: {
  initialAgents: Agent[];
}) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Agent>>({});

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.agencyName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const startEdit = (agent: Agent) => {
    setEditingId(agent._id);
    setEditData({
      subscriptionStatus: agent.subscriptionStatus || "trial",
      subscriptionTier: agent.subscriptionTier || "free",
      subscriptionEndDate: agent.subscriptionEndDate
        ? new Date(agent.subscriptionEndDate).toISOString().split("T")[0]
        : "",
      isAdmin: agent.isAdmin || false,
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setError(null);
  };

  const saveChanges = useCallback(
    async (agentId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/agents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            subscriptionStatus: editData.subscriptionStatus,
            subscriptionTier: editData.subscriptionTier,
            subscriptionEndDate: editData.subscriptionEndDate || null,
            isAdmin: editData.isAdmin,
          }),
        });

        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Failed to update agent",
          );

        const { agent: updatedAgent } = await response.json();
        setAgents(
          agents.map((a) =>
            a._id === agentId ? { ...a, ...updatedAgent } : a,
          ),
        );
        setEditingId(null);
        setEditData({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update agent");
      } finally {
        setLoading(false);
      }
    },
    [editData, agents],
  );

  return (
    <div className="page-card">
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, email, or agency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--status-expired-bg)",
            color: "var(--status-expired)",
            fontSize: "13px",
            fontWeight: 600,
            borderBottom: "1px solid var(--border)",
          }}
        >
          {error}
        </div>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Agent Details</th>
              <th>Agency Info</th>
              <th>Status</th>
              <th>Plan Tier</th>
              <th>Valid Until</th>
              <th>Role</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-muted)",
                  }}
                >
                  No agents found matching your search.
                </td>
              </tr>
            ) : (
              filteredAgents.map((agent) => {
                const currentStatus = agent.subscriptionStatus || "trial";
                const currentTier = agent.subscriptionTier || "free";
                const conf =
                  statusConfig[currentStatus as keyof typeof statusConfig] ||
                  statusConfig.trial;
                const isEd = editingId === agent._id;

                return (
                  <tr key={agent._id}>
                    <td>
                      <div className="td-name">{agent.name}</div>
                      <div className="td-muted">{agent.email}</div>
                    </td>
                    <td>
                      <div className="td-name">{agent.agencyName}</div>
                      <div className="td-muted">
                        {agent.licenseNumber
                          ? `ID: ${agent.licenseNumber}`
                          : "No License"}
                      </div>
                    </td>
                    <td>
                      {isEd ? (
                        <select
                          className="filter-select"
                          style={{ padding: "6px 12px", minWidth: "110px" }}
                          value={editData.subscriptionStatus || currentStatus}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              subscriptionStatus: e.target.value as any,
                            })
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="trial">Trial</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "12.5px",
                            color: conf.color,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: conf.color,
                              display: "inline-block",
                            }}
                          />
                          {conf.label}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEd ? (
                        <select
                          className="filter-select"
                          style={{ padding: "6px 12px", minWidth: "110px" }}
                          value={editData.subscriptionTier || currentTier}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              subscriptionTier: e.target.value as any,
                            })
                          }
                        >
                          <option value="free">Free</option>
                          <option value="basic">Basic</option>
                          <option value="premium">Premium</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            textTransform: "capitalize",
                            fontWeight: 500,
                            fontSize: "13px",
                          }}
                        >
                          {currentTier}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEd ? (
                        <input
                          type="date"
                          className="filter-select"
                          style={{ padding: "6px 12px" }}
                          value={editData.subscriptionEndDate || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              subscriptionEndDate: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: "12.5px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {agent.subscriptionEndDate
                            ? formatDate(agent.subscriptionEndDate)
                            : "Lifetime"}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEd ? (
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            cursor: "pointer",
                            fontSize: "13px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={editData.isAdmin || false}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                isAdmin: e.target.checked,
                              })
                            }
                          />
                          Admin Access
                        </label>
                      ) : (
                        <span
                          className="status-badge"
                          style={{
                            background: agent.isAdmin
                              ? "var(--life-bg)"
                              : "var(--border-light)",
                            color: agent.isAdmin
                              ? "var(--life)"
                              : "var(--text-muted)",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        >
                          {agent.isAdmin ? "Admin" : "Agent"}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className="td-actions"
                        style={{ justifyContent: "flex-end" }}
                      >
                        {isEd ? (
                          <>
                            <button
                              onClick={() => saveChanges(agent._id)}
                              disabled={loading}
                              className="btn btn-primary"
                              style={{ padding: "6px 10px", height: "auto" }}
                            >
                              <Save size={14} /> Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={loading}
                              className="btn"
                              style={{
                                padding: "6px 10px",
                                height: "auto",
                                background: "#fff",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(agent)}
                            className="btn"
                            style={{
                              padding: "6px 10px",
                              height: "auto",
                              background: "#fff",
                            }}
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
