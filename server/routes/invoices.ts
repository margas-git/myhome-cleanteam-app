import { Router, Request, Response } from "express";
import { db } from "../db/connection.js";
import { invoices, invoiceItems, invoicePayments, customers, jobs, timeEntries, users, teams } from "../db/schema.js";
import { eq, and, sql, desc, inArray, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// === INVOICE MANAGEMENT ===

// Get all invoices with customer details
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, customerId, dateFrom, dateTo } = req.query;
    
    let whereConditions = [];
    
    if (status) {
      whereConditions.push(eq(invoices.status, status as "draft" | "sent" | "paid" | "overdue" | "cancelled"));
    }
    
    if (customerId) {
      whereConditions.push(eq(invoices.customerId, parseInt(customerId as string)));
    }
    
    if (dateFrom) {
      whereConditions.push(gte(invoices.issueDate, dateFrom as string));
    }
    
    if (dateTo) {
      whereConditions.push(lte(invoices.issueDate, dateTo as string));
    }

    const allInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: customers.name,
        customerEmail: customers.email,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        totalAmount: invoices.totalAmount,
        notes: invoices.notes,
        paymentTerms: invoices.paymentTerms,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(invoices.createdAt));

    res.json({ success: true, data: allInvoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ success: false, error: "Failed to fetch invoices" });
  }
});

// Get single invoice with items and payments
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    // Get invoice details
    const invoiceData = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: customers.name,
        customerAddress: customers.address,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        totalAmount: invoices.totalAmount,
        notes: invoices.notes,
        paymentTerms: invoices.paymentTerms,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (invoiceData.length === 0) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    // Get invoice items
    const items = await db
      .select({
        id: invoiceItems.id,
        jobId: invoiceItems.jobId,
        description: invoiceItems.description,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        totalPrice: invoiceItems.totalPrice,
        jobDate: jobs.createdAt,
        teamName: teams.name
      })
      .from(invoiceItems)
      .leftJoin(jobs, eq(invoiceItems.jobId, jobs.id))
      .leftJoin(teams, eq(jobs.teamId, teams.id))
      .where(eq(invoiceItems.invoiceId, invoiceId));

    // Get invoice payments
    const payments = await db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId))
      .orderBy(desc(invoicePayments.paymentDate));

    const invoice = {
      ...invoiceData[0],
      items,
      payments
    };

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ success: false, error: "Failed to fetch invoice" });
  }
});

// Create new invoice
router.post("/", async (req: Request, res: Response) => {
  try {
    const { customerId, issueDate, dueDate, jobIds, notes, paymentTerms } = req.body;

    if (!customerId || !issueDate || !dueDate || !jobIds || jobIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Customer ID, issue date, due date, and job IDs are required"
      });
    }

    // Get customer details
    const customer = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    // Get jobs to invoice
    const jobsToInvoice = await db
      .select({
        id: jobs.id,
        customerId: jobs.customerId,
        price: customers.price,
        createdAt: jobs.createdAt,
        teamName: teams.name
      })
      .from(jobs)
      .innerJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(teams, eq(jobs.teamId, teams.id))
      .where(
        and(
          inArray(jobs.id, jobIds),
          eq(jobs.status, "completed")
        )
      );

    if (jobsToInvoice.length === 0) {
      return res.status(400).json({ success: false, error: "No completed jobs found to invoice" });
    }

    // Generate invoice number (INV-YYYY-MM-XXX format)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const lastInvoice = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${`INV-${year}-${month}-%`}`)
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);

    let sequence = 1;
    if (lastInvoice.length > 0) {
      const lastNumber = lastInvoice[0].invoiceNumber;
      const lastSequence = parseInt(lastNumber.split('-')[3]);
      sequence = lastSequence + 1;
    }

    const invoiceNumber = `INV-${year}-${month}-${String(sequence).padStart(3, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const items = [];

    for (const job of jobsToInvoice) {
      const price = job.price || 0;
      subtotal += price;
      items.push({
        jobId: job.id,
        description: `Cleaning service - ${job.teamName || 'Team'}`,
        quantity: 1,
        unitPrice: price,
        totalPrice: price
      });
    }

    const taxAmount = 0; // No tax for now, can be configured later
    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const [newInvoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        customerId,
        issueDate: issueDate,
        dueDate: dueDate,
        status: "draft",
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        notes: notes || null,
        paymentTerms: paymentTerms || "Net 30"
      })
      .returning();

    // Create invoice items
    const invoiceItemsToCreate = items.map(item => ({
      invoiceId: newInvoice.id,
      jobId: item.jobId,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString()
    }));

    await db.insert(invoiceItems).values(invoiceItemsToCreate);

    res.json({ success: true, data: newInvoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ success: false, error: "Failed to create invoice" });
  }
});

// Update invoice status
router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required"
      });
    }

    const [updatedInvoice] = await db
      .update(invoices)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (!updatedInvoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    res.json({ success: true, data: updatedInvoice });
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({ success: false, error: "Failed to update invoice status" });
  }
});

// Add payment to invoice
router.post("/:id/payments", async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentDate, paymentMethod, reference, notes } = req.body;

    if (!amount || !paymentDate) {
      return res.status(400).json({
        success: false,
        error: "Amount and payment date are required"
      });
    }

    const [newPayment] = await db
      .insert(invoicePayments)
      .values({
        invoiceId,
        amount: amount.toString(),
        paymentDate: paymentDate,
        paymentMethod: paymentMethod || null,
        reference: reference || null,
        notes: notes || null
      })
      .returning();

    // Check if invoice is now fully paid
    const invoice = await db
      .select({ totalAmount: invoices.totalAmount })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    const totalPayments = await db
      .select({ totalPaid: sql<number>`COALESCE(SUM(${invoicePayments.amount}), 0)` })
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));

    if (invoice.length > 0 && totalPayments.length > 0) {
      const isFullyPaid = parseFloat(totalPayments[0].totalPaid.toString()) >= parseFloat(invoice[0].totalAmount.toString());
      
      if (isFullyPaid) {
        await db
          .update(invoices)
          .set({ 
            status: "paid",
            updatedAt: new Date()
          })
          .where(eq(invoices.id, invoiceId));
      }
    }

    res.json({ success: true, data: newPayment });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ success: false, error: "Failed to add payment" });
  }
});

// Get jobs available for invoicing
router.get("/jobs/available", async (req: Request, res: Response) => {
  try {
    const { customerId } = req.query;
    
    let whereConditions = [
      eq(jobs.status, "completed"),
      isNull(jobs.id) // This will be replaced with a proper check
    ];

    if (customerId) {
      whereConditions.push(eq(jobs.customerId, parseInt(customerId as string)));
    }

    // Get completed jobs that haven't been invoiced yet
    const availableJobs = await db
      .select({
        id: jobs.id,
        customerId: jobs.customerId,
        customerName: customers.name,
        price: customers.price,
        createdAt: jobs.createdAt,
        teamName: teams.name,
        teamColor: teams.colorHex
      })
      .from(jobs)
      .innerJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(teams, eq(jobs.teamId, teams.id))
      .where(
        and(
          eq(jobs.status, "completed"),
          sql`${jobs.id} NOT IN (
            SELECT DISTINCT ${invoiceItems.jobId} 
            FROM ${invoiceItems}
          )`
        )
      )
      .orderBy(desc(jobs.createdAt));

    res.json({ success: true, data: availableJobs });
  } catch (error) {
    console.error("Error fetching available jobs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch available jobs" });
  }
});

// Get invoice statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter;
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        dateFilter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        dateFilter = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get invoice statistics
    const stats = await db
      .select({
        totalInvoices: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.totalAmount} ELSE 0 END), 0)`,
        overdueAmount: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'overdue' THEN ${invoices.totalAmount} ELSE 0 END), 0)`
      })
      .from(invoices)
      .where(gte(invoices.issueDate, dateFilter.toISOString().split('T')[0]));

    // Get status breakdown
    const statusBreakdown = await db
      .select({
        status: invoices.status,
        count: sql<number>`COUNT(*)`,
        amount: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`
      })
      .from(invoices)
      .where(gte(invoices.issueDate, dateFilter.toISOString().split('T')[0]))
      .groupBy(invoices.status);

    res.json({ 
      success: true, 
      data: {
        ...stats[0],
        statusBreakdown
      }
    });
  } catch (error) {
    console.error("Error fetching invoice stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch invoice statistics" });
  }
});

export default router; 