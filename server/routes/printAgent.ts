import { Router, Request, Response } from 'express';
import { printAgentService } from '../services/printAgentService';
import { PrintAgent, PrintJob, Printer, PairingCode } from '../models/mongodb-models';

const router = Router();

// Health check endpoint (no auth required)
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'print-agent',
    timestamp: Date.now()
  });
});

// Debug endpoint to check agent (no auth required, for troubleshooting)
router.get('/debug/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = await PrintAgent.findOne({ agentId });
    
    if (!agent) {
      return res.json({ 
        found: false, 
        message: `Agent ${agentId} not found in database`,
        allAgents: (await PrintAgent.find({}).select('agentId outletId').limit(10)).map(a => ({
          agentId: a.agentId,
          outletId: a.outletId
        }))
      });
    }

    res.json({
      found: true,
      agentId: agent.agentId,
      outletId: agent.outletId,
      hasApiKey: !!agent.apiKey,
      apiKeyLength: agent.apiKey?.length || 0,
      apiKeyPreview: agent.apiKey ? agent.apiKey.substring(0, 16) + '...' : null,
      status: agent.status,
      version: agent.version,
      platform: agent.platform,
      lastSeen: agent.lastSeen
    });
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({ error: 'Failed to get agent info' });
  }
});

// Middleware to validate API key
async function validateApiKey(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Missing or invalid authorization header');
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  const agentId = req.query.agentId as string || req.body.agentId;

  console.log(`🔐 API Key validation request:`, {
    agentId: agentId ? agentId.substring(0, 20) + '...' : 'missing',
    apiKeyLength: apiKey?.length || 0,
    method: req.method,
    path: req.path
  });

  if (!agentId) {
    console.error('❌ Agent ID missing from request');
    return res.status(400).json({ error: 'Agent ID required' });
  }

  const isValid = await printAgentService.validateApiKey(agentId, apiKey);
  if (!isValid) {
    console.error(`❌ API key validation failed for agent ${agentId}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }

  console.log(`✅ API key validated successfully for agent ${agentId}`);
  next();
}

// Rate limiting middleware (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimiter(req: Request, res: Response, next: Function) {
  const agentId = req.query.agentId as string || req.body.agentId;
  if (!agentId) return next();

  const now = Date.now();
  const limit = 100; // 100 requests per minute
  const window = 60 * 1000; // 1 minute

  let record = requestCounts.get(agentId);
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + window };
    requestCounts.set(agentId, record);
  }

  record.count++;

  if (record.count > limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  next();
}

// GET /api/print/jobs - Get pending print jobs (for polling fallback)
router.get('/jobs', validateApiKey, rateLimiter, async (req: Request, res: Response) => {
  try {
    const { agentId, outletId } = req.query;

    if (!agentId || !outletId) {
      return res.status(400).json({ error: 'agentId and outletId required' });
    }

    // Verify agent belongs to outlet
    const agent = await PrintAgent.findOne({ agentId: agentId as string });
    if (!agent || agent.outletId !== outletId) {
      return res.status(403).json({ error: 'Agent not authorized for this outlet' });
    }

    // Get pending jobs
    const jobs = await printAgentService.getPendingJobs(
      outletId as string,
      agentId as string
    );

    res.json({ jobs });
  } catch (error) {
    console.error('❌ Error getting print jobs:', error);
    res.status(500).json({ error: 'Failed to get print jobs' });
  }
});

// POST /api/print/ack - Receive print job acknowledgments
router.post('/ack', validateApiKey, rateLimiter, async (req: Request, res: Response) => {
  try {
    const { jobId, agentId, status, error, timestamp } = req.body;

    if (!jobId || !agentId || !status) {
      return res.status(400).json({ error: 'jobId, agentId, and status required' });
    }

    if (!['printed', 'failed', 'retrying'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify job belongs to agent
    const job = await PrintJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.agentId && job.agentId !== agentId) {
      return res.status(403).json({ error: 'Job not assigned to this agent' });
    }

    // Update job status
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === 'printed') {
      updateData.printedAt = new Date(timestamp || Date.now());
    }

    if (error) {
      updateData.error = error;
    }

    await PrintJob.updateOne({ jobId }, { $set: updateData });

    console.log(`✅ Job ${jobId} acknowledged with status: ${status} by agent ${agentId}`);

    res.json({ success: true, jobId, status });
  } catch (error) {
    console.error('❌ Error processing print acknowledgment:', error);
    res.status(500).json({ error: 'Failed to process acknowledgment' });
  }
});

// POST /api/print/pair/generate - Generate pairing code (admin only)
router.post('/pair/generate', async (req: Request, res: Response) => {
  try {
    const { outletId, expiresInMinutes } = req.body;

    if (!outletId) {
      return res.status(400).json({ error: 'outletId required' });
    }

    const code = await printAgentService.generatePairingCode(
      outletId,
      expiresInMinutes || 15
    );

    res.json({ code, expiresInMinutes: expiresInMinutes || 15 });
  } catch (error) {
    console.error('❌ Error generating pairing code:', error);
    res.status(500).json({ error: 'Failed to generate pairing code' });
  }
});

// POST /api/print/pair/exchange - Exchange pairing code for API key
router.post('/pair/exchange', async (req: Request, res: Response) => {
  try {
    const { code, agentId } = req.body;

    if (!code || !agentId) {
      return res.status(400).json({ error: 'code and agentId required' });
    }

    const result = await printAgentService.exchangePairingCode(code, agentId);

    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired pairing code' });
    }

    res.json({
      success: true,
      apiKey: result.apiKey,
      outletId: result.outletId
    });
  } catch (error) {
    console.error('❌ Error exchanging pairing code:', error);
    res.status(500).json({ error: 'Failed to exchange pairing code' });
  }
});

// GET /api/print/agents - Get all agents for an outlet
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const { outletId } = req.query;

    if (!outletId) {
      return res.status(400).json({ error: 'outletId required' });
    }

    const agents = await PrintAgent.find({ outletId }).sort({ createdAt: -1 });

    // Get printers for each agent
    const agentsWithPrinters = await Promise.all(
      agents.map(async (agent: any) => {
        const printers = await Printer.find({ agentId: agent.agentId });
        return {
          agentId: agent.agentId,
          outletId: agent.outletId,
          version: agent.version,
          platform: agent.platform,
          status: agent.status,
          capabilities: JSON.parse(agent.capabilities || '{}'),
          lastSeen: agent.lastSeen,
          createdAt: agent.createdAt,
          printers: printers.map((p: any) => ({
            id: p.printerId,
            name: p.name,
            type: p.type,
            isDefault: p.isDefault
          }))
        };
      })
    );

    res.json({ agents: agentsWithPrinters });
  } catch (error) {
    console.error('❌ Error getting agents:', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

// GET /api/print/jobs/history - Get print job history for an outlet
router.get('/jobs/history', async (req: Request, res: Response) => {
  try {
    const { outletId, limit = 50, status } = req.query;

    if (!outletId) {
      return res.status(400).json({ error: 'outletId required' });
    }

    const query: any = { outletId };
    if (status) {
      query.status = status;
    }

    const jobs = await PrintJob.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .populate('orderId');

    const jobHistory = jobs.map((job: any) => ({
      jobId: job.jobId,
      agentId: job.agentId,
      receiptType: job.receiptType,
      priority: job.priority,
      status: job.status,
      error: job.error,
      orderNumber: job.orderNumber,
      createdAt: job.createdAt,
      sentAt: job.sentAt,
      printedAt: job.printedAt
    }));

    res.json({ jobs: jobHistory });
  } catch (error) {
    console.error('❌ Error getting job history:', error);
    res.status(500).json({ error: 'Failed to get job history' });
  }
});

// DELETE /api/print/agents/:agentId - Delete an agent
router.delete('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    // Delete agent
    await PrintAgent.deleteOne({ agentId });

    // Delete associated printers
    await Printer.deleteMany({ agentId });

    console.log(`🗑️ Deleted agent ${agentId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// GET /api/print/stats - Get print agent statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { outletId } = req.query;

    const query: any = {};
    if (outletId) {
      query.outletId = outletId;
    }

    const totalAgents = await PrintAgent.countDocuments(query);
    const onlineAgents = await PrintAgent.countDocuments({ ...query, status: 'online' });
    const totalJobs = await PrintJob.countDocuments(query);
    const pendingJobs = await PrintJob.countDocuments({ ...query, status: 'pending' });
    const printedJobs = await PrintJob.countDocuments({ ...query, status: 'printed' });
    const failedJobs = await PrintJob.countDocuments({ ...query, status: 'failed' });

    // Get WebSocket stats
    const wsStats = printAgentService.getStats();

    res.json({
      agents: {
        total: totalAgents,
        online: onlineAgents,
        offline: totalAgents - onlineAgents
      },
      jobs: {
        total: totalJobs,
        pending: pendingJobs,
        printed: printedJobs,
        failed: failedJobs
      },
      websocket: wsStats
    });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// POST /api/print/test - Create a test print job
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { outletId, receiptType = 'TOKEN' } = req.body;

    if (!outletId) {
      return res.status(400).json({ error: 'outletId required' });
    }

    // Create test content based on receipt type
    let content: any;
    if (receiptType === 'TOKEN') {
      content = {
        tokenNumber: `TEST-${Date.now()}`,
        orderNumber: 'TEST-ORDER'
      };
    } else if (receiptType === 'KOT') {
      content = {
        orderNumber: `ORDER-${Date.now()}`,
        table: 'TABLE-1',
        timestamp: new Date().toISOString(),
        items: [
          { qty: 2, name: 'Test Item 1', modifiers: 'Extra sauce', notes: 'Test note' },
          { qty: 1, name: 'Test Item 2' }
        ]
      };
    } else {
      content = {
        restaurantName: 'Test Restaurant',
        restaurantAddress: '123 Test St',
        restaurantPhone: '555-1234',
        billNumber: `BILL-${Date.now()}`,
        table: 'TABLE-1',
        items: [
          { name: 'Test Item 1', qty: 2, price: 10 },
          { name: 'Test Item 2', qty: 1, price: 15 }
        ],
        subtotal: 35,
        tax: 3.5,
        discount: 0,
        total: 38.5,
        footer: 'Thank you for your order!'
      };
    }

    const jobId = await printAgentService.createPrintJob(
      outletId,
      receiptType,
      content,
      { priority: 'high' }
    );

    res.json({ success: true, jobId, message: 'Test print job created' });
  } catch (error) {
    console.error('❌ Error creating test job:', error);
    res.status(500).json({ error: 'Failed to create test job' });
  }
});

export default router;

