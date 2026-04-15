"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAllCustomers, deleteCustomer, CustomerDoc } from "@/lib/storage";
import { getStatus, formatCurrency, formatDate } from "@/lib/utils";
import { PolicyType } from "@/lib/types";
import PolicyBadge from "@/components/PolicyBadge";
import StatusBadge from "@/components/StatusBadge";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

type FilterType = "all" | PolicyType;
type FilterStatus = "all" | "Active" | "Expired" | "Expiring Soon";

export default function CustomersContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(
    searchParams.get("filter") === "expiring" ? "Expiring Soon" : "all",
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Debounced search val for the query key
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(val);
    }, 400);
  }

  // React Query Fetcher
  const { data, dataUpdatedAt, isFetching, refetch, isError, error } = useQuery(
    {
      queryKey: [
        "customers",
        { page, search: debouncedSearch, typeFilter, statusFilter },
      ],
      queryFn: async () => {
        return getAllCustomers({
          search: debouncedSearch || undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          page: page,
          limit: 20,
        });
      },
      staleTime: Infinity, // On-Demand Caching
    },
  );

  const mutation = useMutation({
    mutationFn: deleteCustomer,
    onMutate: async (deletedId) => {
      // Optimistic UI update
      await queryClient.cancelQueries({ queryKey: ["customers"] });
      const previousData = queryClient.getQueryData([
        "customers",
        { page, search: debouncedSearch, typeFilter, statusFilter },
      ]);

      queryClient.setQueryData(
        [
          "customers",
          { page, search: debouncedSearch, typeFilter, statusFilter },
        ],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            total: old.total - 1,
            customers: old.customers.filter((c: any) => c._id !== deletedId),
          };
        },
      );
      return { previousData };
    },
    onError: (err, deletedId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          [
            "customers",
            { page, search: debouncedSearch, typeFilter, statusFilter },
          ],
          context.previousData,
        );
      }
      alert("Failed to delete customer");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeleteConfirm(null);
    },
  });

  function handleDelete(id: string) {
    mutation.mutate(id);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  const hasFilters = search || typeFilter !== "all" || statusFilter !== "all";
  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customers</h1>
          <p>
            {total} total customer{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            <span suppressHydrationWarning>
              {dataUpdatedAt
                ? `Last synced ${formatDistanceToNow(dataUpdatedAt)} ago`
                : "Synced"}
            </span>
            <button
              onClick={() => refetch()}
              className="btn btn-ghost btn-sm"
              disabled={isFetching}
              title="Force Refresh Cache"
            >
              <RefreshCw size={14} className={isFetching ? "spin" : ""} />
            </button>
          </div>
          <Link href="/dashboard/customers/new" className="btn btn-primary">
            <Plus size={16} /> Add New Customer
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, phone, or policy number…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            id="customer-search"
          />
        </div>

        <select
          className="filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as FilterType);
            setPage(1);
          }}
          id="type-filter"
        >
          <option value="all">All Types</option>
          <option value="motor">Motor</option>
          <option value="medical">Medical</option>
          <option value="fire">Fire</option>
          <option value="life">Life</option>
          <option value="personal-accident">Personal Accident</option>
          <option value="marine">Marine Insurance</option>
          <option value="workman-compensation">Workman Compensation</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as FilterStatus);
            setPage(1);
          }}
          id="status-filter"
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
        </select>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />{" "}
          {(error as Error)?.message || "Failed to load customers"}
        </div>
      )}

      {/* Loading */}
      {isFetching && !data ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Loading customers…
        </div>
      ) : customers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>
              {total === 0 && !hasFilters
                ? "No customers yet"
                : "No results found"}
            </h3>
            <p>
              {total === 0 && !hasFilters
                ? "Add your first customer policy to get started."
                : "Try adjusting your search or filter criteria."}
            </p>
            {total === 0 && !hasFilters && (
              <Link
                href="/dashboard/customers/new"
                className="btn btn-primary btn-sm"
                style={{ marginTop: 14 }}
              >
                <Plus size={14} /> Add Customer
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Policy Number</th>
                  <th>Premium</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((p: any) => {
                  const status = getStatus(p.endDate);
                  return (
                    <tr
                      key={p._id}
                      style={{
                        opacity: mutation.variables === p._id ? 0.5 : 1,
                      }}
                    >
                      <td>
                        <div className="td-name">{p.customerName}</div>
                        <div className="td-muted">{p.phone}</div>
                      </td>
                      <td>
                        <PolicyBadge type={p.type} />
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 13 }}>
                        {p.policyNumber || "—"}
                      </td>
                      <td>{formatCurrency(p.premiumAmount)}</td>
                      <td>
                        {formatDate(p.endDate)}
                        {status === "Expiring Soon" && (
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              color: "var(--fire)",
                              marginTop: 2,
                              fontWeight: 600,
                            }}
                          >
                            <AlertTriangle
                              size={10}
                              style={{
                                marginRight: 3,
                                verticalAlign: "middle",
                              }}
                            />
                            Expiring soon
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>
                        <div className="td-actions">
                          <Link
                            href={`/dashboard/customers/${p._id}`}
                            className="btn btn-sm btn-ghost"
                            title="View"
                          >
                            <Eye size={13} />
                          </Link>
                          <Link
                            href={`/dashboard/customers/new?id=${p._id}`}
                            className="btn btn-sm btn-outline"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </Link>
                          <button
                            className="btn btn-sm btn-danger"
                            title="Delete"
                            onClick={() => setDeleteConfirm(p._id)}
                            disabled={mutation.isPending}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
              }}
            >
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div
          className="confirm-overlay"
          onClick={() => !mutation.isPending && setDeleteConfirm(null)}
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Customer?</h3>
            <p>
              This will permanently remove the customer record and all policy
              information. This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(null)}
                disabled={mutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `,
        }}
      />
    </div>
  );
}
