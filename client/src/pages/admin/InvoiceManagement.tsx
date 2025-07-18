import React, { useState, useEffect } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { buildApiUrl } from "../../config/api";
import { format } from "date-fns";

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  paymentTerms: string;
  createdAt: string;
  updatedAt: string;
}

interface AvailableJob {
  id: number;
  customerId: number;
  customerName: string;
  price: number;
  createdAt: string;
  teamName: string | null;
  teamColor: string | null;
}

interface Customer {
  id: number;
  name: string;
  email: string | null;
}

export function InvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    customerId: "",
    dateFrom: "",
    dateTo: ""
  });

  // Create invoice form state
  const [createForm, setCreateForm] = useState({
    customerId: "",
    issueDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    jobIds: [] as number[],
    notes: "",
    paymentTerms: "Net 30"
  });

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchAvailableJobs();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.customerId) params.append("customerId", filters.customerId);
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);

      const res = await fetch(buildApiUrl(`/api/invoices?${params}`), {
        credentials: "include"
      });
      const data = await res.json();
      
      if (res.ok) {
        setInvoices(data.data);
      } else {
        setError(data.error || "Failed to fetch invoices");
      }
    } catch (err) {
      setError("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(buildApiUrl("/api/admin/customers"), {
        credentials: "include"
      });
      const data = await res.json();
      
      if (res.ok) {
        setCustomers(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    }
  };

  const fetchAvailableJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (createForm.customerId) {
        params.append("customerId", createForm.customerId);
      }

      const res = await fetch(buildApiUrl(`/api/invoices/jobs/available?${params}`), {
        credentials: "include"
      });
      const data = await res.json();
      
      if (res.ok) {
        setAvailableJobs(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch available jobs:", err);
    }
  };

  const handleCreateInvoice = async () => {
    try {
      if (!createForm.customerId || createForm.jobIds.length === 0) {
        setError("Please select a customer and at least one job");
        return;
      }

      const res = await fetch(buildApiUrl("/api/invoices"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm)
      });

      const data = await res.json();
      
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({
          customerId: "",
          issueDate: format(new Date(), "yyyy-MM-dd"),
          dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
          jobIds: [],
          notes: "",
          paymentTerms: "Net 30"
        });
        fetchInvoices();
      } else {
        setError(data.error || "Failed to create invoice");
      }
    } catch (err) {
      setError("Failed to create invoice");
    }
  };

  const handleStatusUpdate = async (invoiceId: number, status: string) => {
    try {
      const res = await fetch(buildApiUrl(`/api/invoices/${invoiceId}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      
      if (res.ok) {
        fetchInvoices();
      } else {
        setError(data.error || "Failed to update invoice status");
      }
    } catch (err) {
      setError("Failed to update invoice status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "paid": return "bg-green-100 text-green-800";
      case "overdue": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD"
    }).format(amount);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading invoices...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Invoice
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer
              </label>
              <select
                value={filters.customerId}
                onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.customerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(invoice.issueDate), "dd/MM/yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(invoice.dueDate), "dd/MM/yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(invoice.totalAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowInvoiceModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    <select
                      value={invoice.status}
                      onChange={(e) => handleStatusUpdate(invoice.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Create New Invoice</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer
                  </label>
                  <select
                    value={createForm.customerId}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, customerId: e.target.value, jobIds: [] });
                      fetchAvailableJobs();
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={createForm.issueDate}
                      onChange={(e) => setCreateForm({ ...createForm, issueDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={createForm.dueDate}
                      onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Jobs
                  </label>
                  <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                    {availableJobs.length === 0 ? (
                      <p className="text-gray-500">No available jobs for this customer</p>
                    ) : (
                      availableJobs.map(job => (
                        <label key={job.id} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={createForm.jobIds.includes(job.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateForm({
                                  ...createForm,
                                  jobIds: [...createForm.jobIds, job.id]
                                });
                              } else {
                                setCreateForm({
                                  ...createForm,
                                  jobIds: createForm.jobIds.filter(id => id !== job.id)
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">
                            {format(new Date(job.createdAt), "dd/MM/yyyy")} - {job.teamName || 'No Team'} - {formatCurrency(job.price)}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={createForm.paymentTerms}
                    onChange={(e) => setCreateForm({ ...createForm, paymentTerms: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateInvoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Invoice Modal */}
        {showInvoiceModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Invoice {selectedInvoice.invoiceNumber}</h2>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-semibold mb-2">Invoice Details</h3>
                  <p><strong>Customer:</strong> {selectedInvoice.customerName}</p>
                  <p><strong>Issue Date:</strong> {format(new Date(selectedInvoice.issueDate), "dd/MM/yyyy")}</p>
                  <p><strong>Due Date:</strong> {format(new Date(selectedInvoice.dueDate), "dd/MM/yyyy")}</p>
                  <p><strong>Status:</strong> {selectedInvoice.status}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Amounts</h3>
                  <p><strong>Subtotal:</strong> {formatCurrency(selectedInvoice.subtotal)}</p>
                  <p><strong>Tax:</strong> {formatCurrency(selectedInvoice.taxAmount)}</p>
                  <p><strong>Total:</strong> {formatCurrency(selectedInvoice.totalAmount)}</p>
                  <p><strong>Payment Terms:</strong> {selectedInvoice.paymentTerms}</p>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-gray-700">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default InvoiceManagement; 