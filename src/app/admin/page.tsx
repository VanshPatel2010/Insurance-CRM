import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Agent from "@/models/Agent";
import AgentsManagementClient from "@/components/admin/AgentsManagementClient";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Manage Agents — Admin Panel",
};

async function getAgents() {
  await connectDB();
  const agents = await Agent.find({})
    .select("-password")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return agents.map((agent: any) => ({
    ...agent,
    _id: agent._id.toString(),
    createdAt: agent.createdAt ? new Date(agent.createdAt).toISOString() : null,
    subscriptionStartDate: agent.subscriptionStartDate
      ? new Date(agent.subscriptionStartDate).toISOString()
      : null,
    subscriptionEndDate: agent.subscriptionEndDate
      ? new Date(agent.subscriptionEndDate).toISOString()
      : null,
  }));
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!(session?.user as any)?.isAdmin) {
    return (
      <div
        className="page-card"
        style={{ textAlign: "center", padding: "40px", marginTop: "20px" }}
      >
        <Shield
          size={40}
          style={{ color: "var(--status-expired)", margin: "0 auto 10px" }}
        />
        <h2>Access Denied</h2>
        <p>You must have administrator privileges to view this page.</p>
      </div>
    );
  }

  const agents = await getAgents();
  const activeCount = agents.filter(
    (a) => a.subscriptionStatus === "active",
  ).length;
  const trialCount = agents.filter(
    (a) => (a.subscriptionStatus || "trial") === "trial",
  ).length;
  const adminCount = agents.filter((a) => a.isAdmin).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Agents Management</h1>
          <p>Monitor and manage {agents.length} system accounts and access</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <div
          className="stat-card"
          style={{ borderLeft: "4px solid var(--motor)" }}
        >
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: "var(--motor-bg)", color: "var(--motor)" }}
            >
              👥
            </div>
            <span
              className="stat-card-badge"
              style={{ background: "var(--motor-bg)", color: "var(--motor)" }}
            >
              All
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--motor)" }}>
            {agents.length}
          </div>
          <div className="stat-card-label">Total Agents</div>
        </div>

        <div
          className="stat-card"
          style={{ borderLeft: "4px solid var(--status-active)" }}
        >
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{
                background: "var(--status-active-bg)",
                color: "var(--status-active)",
              }}
            >
              ✓
            </div>
            <span
              className="stat-card-badge"
              style={{
                background: "var(--status-active-bg)",
                color: "var(--status-active)",
              }}
            >
              Pro
            </span>
          </div>
          <div
            className="stat-card-value"
            style={{ color: "var(--status-active)" }}
          >
            {activeCount}
          </div>
          <div className="stat-card-label">Active Subs</div>
        </div>

        <div
          className="stat-card"
          style={{ borderLeft: "4px solid var(--fire)" }}
        >
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: "var(--fire-bg)", color: "var(--fire)" }}
            >
              ⧗
            </div>
            <span
              className="stat-card-badge"
              style={{ background: "var(--fire-bg)", color: "var(--fire)" }}
            >
              Free
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--fire)" }}>
            {trialCount}
          </div>
          <div className="stat-card-label">Trial Users</div>
        </div>

        <div
          className="stat-card"
          style={{ borderLeft: "4px solid var(--life)" }}
        >
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: "var(--life-bg)", color: "var(--life)" }}
            >
              🛡️
            </div>
            <span
              className="stat-card-badge"
              style={{ background: "var(--life-bg)", color: "var(--life)" }}
            >
              Admin
            </span>
          </div>
          <div className="stat-card-value" style={{ color: "var(--life)" }}>
            {adminCount}
          </div>
          <div className="stat-card-label">System Admins</div>
        </div>
      </div>

      <AgentsManagementClient initialAgents={agents} />
    </div>
  );
}
