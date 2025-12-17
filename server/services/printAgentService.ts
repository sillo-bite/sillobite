import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import crypto from 'crypto';
import { PrintAgent, PrintJob, Printer, PairingCode } from '../models/mongodb-models';

interface AgentConnection {
  socketId: string;
  agentId: string;
  outletId: string;
  connectedAt: Date;
  printers: AgentPrinter[];
  capabilities: AgentCapabilities;
}

interface AgentPrinter {
  id: string;
  name: string;
  type: 'usb' | 'network' | 'bluetooth' | 'windows';
}

interface AgentCapabilities {
  usb: boolean;
  network: boolean;
  bluetooth: boolean;
  windows: boolean;
}

interface PrintJobPayload {
  jobId: string;
  receiptType: 'KOT' | 'BILL' | 'TOKEN'; // REQUIRED
  content: any; // REQUIRED
  printerType?: string; // Optional - agent will use configured printer if missing
  targetPrinter?: string; // Optional - agent will use configured printer if missing
  escposCommands?: any[]; // Optional
  priority?: 'normal' | 'high' | 'urgent'; // Optional
  createdAt?: number; // Optional
}

interface PrintAckPayload {
  jobId: string;
  agentId: string;
  status: 'printed' | 'failed' | 'retrying';
  error?: string | null;
  timestamp: number;
}

class PrintAgentService {
  private io: SocketIOServer | null = null;
  private connectedAgents: Map<string, AgentConnection> = new Map(); // agentId -> connection
  private outletAgents: Map<string, Set<string>> = new Map(); // outletId -> Set of agentIds

  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      path: '/agent',
      cors: {
        origin: '*', // Allow all origins for agents
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type']
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      allowEIO3: true, // Allow Engine.IO v3 clients
      connectTimeout: 45000,
      upgradeTimeout: 10000
    });

    this.setupEventHandlers();
    console.log('🖨️ Print Agent WebSocket server initialized on /agent path');
    console.log('🖨️ WebSocket URL: wss://your-domain.com/agent');
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', async (socket) => {
      console.log(`🖨️ Print Agent attempting connection: ${socket.id}`);
      console.log(`🖨️ Connection details:`, {
        transport: socket.conn.transport.name,
        remoteAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Get auth data from handshake
      const auth = socket.handshake.auth;
      const { agentId, outletId, apiKey } = auth;

      console.log(`🖨️ Auth data received:`, {
        agentId: agentId ? 'present' : 'missing',
        outletId: outletId ? 'present' : 'missing',
        apiKey: apiKey ? 'present' : 'missing'
      });

      // Validate authentication
      if (!agentId || !outletId || !apiKey) {
        console.error('❌ Print Agent connection rejected: Missing credentials', {
          agentId: !!agentId,
          outletId: !!outletId,
          apiKey: !!apiKey
        });
        socket.emit('error', { message: 'Authentication required', code: 'AUTH_REQUIRED' });
        socket.disconnect();
        return;
      }

      // Validate API key
      try {
        // Try to find agent by exact agentId
        let agent = await PrintAgent.findOne({ agentId });
        
        // If not found, try without "Agent" prefix
        if (!agent && agentId.startsWith('Agent')) {
          const agentIdWithoutPrefix = agentId.substring(5);
          console.log(`🔍 WebSocket: Trying agentId without prefix: ${agentIdWithoutPrefix}`);
          agent = await PrintAgent.findOne({ agentId: agentIdWithoutPrefix });
          if (agent) {
            // Update to match what agent is using
            await PrintAgent.updateOne({ _id: agent._id }, { $set: { agentId } });
            console.log(`✅ WebSocket: Updated agentId to match agent's format`);
          }
        }
        
        // If still not found, try with "Agent" prefix
        if (!agent && !agentId.startsWith('Agent')) {
          const agentIdWithPrefix = 'Agent' + agentId;
          console.log(`🔍 WebSocket: Trying agentId with prefix: ${agentIdWithPrefix}`);
          agent = await PrintAgent.findOne({ agentId: agentIdWithPrefix });
          if (agent) {
            // Update to match what agent is using
            await PrintAgent.updateOne({ _id: agent._id }, { $set: { agentId } });
            console.log(`✅ WebSocket: Updated agentId to match agent's format`);
          }
        }
        
        if (!agent) {
          console.error(`❌ Print Agent connection rejected: Unknown agent ${agentId}`);
          // List available agents
          const allAgents = await PrintAgent.find({}).select('agentId outletId').limit(5);
          console.error(`📋 Available agents:`, allAgents.map(a => a.agentId.substring(0, 30) + '...'));
          socket.emit('error', { message: 'Invalid agent credentials', code: 'AGENT_NOT_FOUND' });
          socket.disconnect();
          return;
        }

        // Simple API key validation (you should use proper encryption in production)
        if (agent.apiKey !== apiKey) {
          console.error(`❌ Print Agent connection rejected: Invalid API key for agent ${agentId}`, {
            storedKeyLength: agent.apiKey?.length || 0,
            providedKeyLength: apiKey?.length || 0,
            storedKeyPreview: agent.apiKey ? agent.apiKey.substring(0, 16) + '...' : null,
            providedKeyPreview: apiKey ? apiKey.substring(0, 16) + '...' : null
          });
          socket.emit('error', { message: 'Invalid API key', code: 'INVALID_API_KEY' });
          socket.disconnect();
          return;
        }

        // Validate outlet
        if (agent.outletId !== outletId) {
          console.error(`❌ Print Agent connection rejected: Outlet mismatch for agent ${agentId}`, {
            expected: agent.outletId,
            received: outletId
          });
          socket.emit('error', { message: 'Invalid outlet', code: 'OUTLET_MISMATCH' });
          socket.disconnect();
          return;
        }

        console.log(`✅ Print Agent authenticated: ${agentId} for outlet ${outletId}`);
        socket.emit('connected', { 
          success: true, 
          message: 'Connection established',
          agentId,
          outletId 
        });

        // Handle agent registration
        socket.on('agent:register', async (data: any) => {
          try {
            await this.handleAgentRegistration(socket, agentId, outletId, data);
          } catch (error) {
            console.error('❌ Error handling agent registration:', error);
            socket.emit('error', { message: 'Registration failed' });
          }
        });

        // Handle print acknowledgment
        socket.on('print:ack', async (data: PrintAckPayload) => {
          try {
            await this.handlePrintAck(data);
          } catch (error) {
            console.error('❌ Error handling print ack:', error);
          }
        });

        // Handle ping/pong
        socket.on('ping', () => {
          socket.emit('pong', { timestamp: Date.now() });
        });

        // Handle disconnection
        socket.on('disconnect', async (reason) => {
          console.log(`🖨️ Print Agent disconnected: ${agentId}, reason: ${reason}`);
          await this.handleAgentDisconnection(agentId, outletId);
        });

        // Handle connection errors
        socket.on('error', (error) => {
          console.error(`❌ Socket error for agent ${agentId}:`, error);
        });

      } catch (error) {
        console.error('❌ Error authenticating print agent:', error);
        socket.emit('error', { 
          message: 'Authentication failed', 
          code: 'AUTH_ERROR',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        socket.disconnect();
      }
    });

    // Handle connection errors at server level
    this.io.engine.on('connection_error', (err) => {
      console.error('❌ WebSocket connection error:', err);
    });
  }

  private async handleAgentRegistration(
    socket: any, 
    agentId: string, 
    outletId: string, 
    data: any
  ): Promise<void> {
    const { version, platform, printers, capabilities, status, timestamp } = data;

    console.log(`🖨️ Registering agent ${agentId}:`, {
      version,
      platform,
      printerCount: printers?.length || 0,
      capabilities,
      status
    });

    // Update agent status in database
    await PrintAgent.updateOne(
      { agentId },
      {
        $set: {
          version,
          platform,
          status: 'online',
          capabilities: JSON.stringify(capabilities || {}),
          lastSeen: new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Store printer information
    if (printers && Array.isArray(printers)) {
      // Remove old printers
      await Printer.deleteMany({ agentId });

      // Add new printers
      const printerDocs = printers.map((printer: AgentPrinter) => ({
        agentId,
        printerId: printer.id,
        name: printer.name,
        type: printer.type,
        isDefault: false,
        capabilities: JSON.stringify({})
      }));

      if (printerDocs.length > 0) {
        await Printer.insertMany(printerDocs);
      }
    }

    // Store connection info
    const connection: AgentConnection = {
      socketId: socket.id,
      agentId,
      outletId,
      connectedAt: new Date(),
      printers: printers || [],
      capabilities: capabilities || { usb: false, network: false, bluetooth: false, windows: false }
    };

    this.connectedAgents.set(agentId, connection);

    // Track outlet -> agent mapping
    if (!this.outletAgents.has(outletId)) {
      this.outletAgents.set(outletId, new Set());
    }
    this.outletAgents.get(outletId)!.add(agentId);

    // Send confirmation
    socket.emit('registered', {
      success: true,
      message: 'Agent registered successfully',
      agentId,
      outletId,
      timestamp: Date.now()
    });

    console.log(`✅ Agent ${agentId} registered successfully for outlet ${outletId}`);

    // Send any pending jobs for this outlet
    await this.sendPendingJobs(agentId, outletId);
  }

  private async handleAgentDisconnection(agentId: string, outletId: string): Promise<void> {
    // Remove from connected agents
    this.connectedAgents.delete(agentId);

    // Remove from outlet mapping
    const outletAgentSet = this.outletAgents.get(outletId);
    if (outletAgentSet) {
      outletAgentSet.delete(agentId);
      if (outletAgentSet.size === 0) {
        this.outletAgents.delete(outletId);
      }
    }

    // Update agent status in database
    await PrintAgent.updateOne(
      { agentId },
      {
        $set: {
          status: 'offline',
          lastSeen: new Date(),
          updatedAt: new Date()
        }
      }
    );

    console.log(`🖨️ Agent ${agentId} marked as offline`);
  }

  private async handlePrintAck(data: PrintAckPayload): Promise<void> {
    const { jobId, agentId, status, error, timestamp } = data;

    console.log(`🖨️ Received print ack for job ${jobId}:`, { agentId, status, error });

    // Update job status in database
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === 'printed') {
      updateData.printedAt = new Date(timestamp);
    }

    if (error) {
      updateData.error = error;
    }

    await PrintJob.updateOne({ jobId }, { $set: updateData });

    console.log(`✅ Job ${jobId} updated with status: ${status}`);

    // If retrying, job will be picked up by next poll/reconnection
    // If failed, mark as permanently failed
  }

  private async sendPendingJobs(agentId: string, outletId: string): Promise<void> {
    try {
      // Find pending jobs for this outlet
      const pendingJobs = await PrintJob.find({
        outletId,
        status: 'pending'
      })
        .sort({ priority: -1, createdAt: 1 })
        .limit(10); // Send up to 10 jobs at a time

      if (pendingJobs.length === 0) {
        console.log(`📭 No pending jobs for outlet ${outletId}`);
        return;
      }

      const connection = this.connectedAgents.get(agentId);
      if (!connection || !this.io) {
        console.log(`❌ Agent ${agentId} not connected, cannot send pending jobs`);
        return;
      }

      console.log(`📤 Sending ${pendingJobs.length} pending jobs to agent ${agentId}`);

      for (const job of pendingJobs) {
        await this.sendJobToAgent(agentId, job);
      }
    } catch (error) {
      console.error(`❌ Error sending pending jobs to agent ${agentId}:`, error);
    }
  }

  private async sendJobToAgent(agentId: string, job: any): Promise<void> {
    const connection = this.connectedAgents.get(agentId);
    if (!connection || !this.io) {
      console.log(`❌ Agent ${agentId} not connected`);
      return;
    }

    // Check if agent has the required printer type
    if (job.printerType) {
      const hasPrinterType = connection.capabilities[job.printerType as keyof AgentCapabilities];
      if (!hasPrinterType) {
        console.log(`⚠️ Agent ${agentId} does not support printer type ${job.printerType}`);
        return;
      }
    }

    // Check if agent has the target printer
    if (job.targetPrinter) {
      const hasPrinter = connection.printers.some(p => p.name === job.targetPrinter);
      if (!hasPrinter) {
        console.log(`⚠️ Agent ${agentId} does not have printer ${job.targetPrinter}`);
        return;
      }
    }

    // Parse content (it's stored as JSON string in database)
    let parsedContent: any = {};
    try {
      parsedContent = typeof job.content === 'string' ? JSON.parse(job.content) : job.content;
    } catch (error) {
      console.error(`❌ Error parsing job content for job ${job.jobId}:`, error);
      parsedContent = {};
    }

    // Parse escposCommands if present
    let parsedEscposCommands: any[] | undefined = undefined;
    if (job.escposCommands) {
      try {
        parsedEscposCommands = typeof job.escposCommands === 'string' 
          ? JSON.parse(job.escposCommands) 
          : job.escposCommands;
      } catch (error) {
        console.error(`❌ Error parsing escposCommands for job ${job.jobId}:`, error);
      }
    }

    const payload: PrintJobPayload = {
      jobId: job.jobId,
      receiptType: job.receiptType, // REQUIRED
      content: parsedContent, // REQUIRED
      printerType: job.printerType || undefined, // Optional
      targetPrinter: job.targetPrinter || undefined, // Optional
      escposCommands: parsedEscposCommands,
      priority: job.priority || 'normal',
      createdAt: job.createdAt ? job.createdAt.getTime() : Date.now()
    };

    console.log(`📤 Sending job ${job.jobId} to agent ${agentId}:`, {
      receiptType: payload.receiptType,
      hasContent: !!payload.content,
      contentKeys: payload.content ? Object.keys(payload.content) : [],
      printerType: payload.printerType,
      targetPrinter: payload.targetPrinter
    });

    // Emit to specific socket
    this.io.to(connection.socketId).emit('print:job', payload);

    // Mark job as sent
    await PrintJob.updateOne(
      { jobId: job.jobId },
      {
        $set: {
          status: 'sent',
          agentId,
          sentAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    console.log(`✅ Job ${job.jobId} sent to agent ${agentId}`);
  }

  // Public method to create and send a print job
  async createPrintJob(
    outletId: string,
    receiptType: 'KOT' | 'BILL' | 'TOKEN',
    content: any,
    options: {
      printerType?: string;
      targetPrinter?: string;
      priority?: 'normal' | 'high' | 'urgent';
      escposCommands?: any[];
      orderId?: string;
      orderNumber?: string;
    } = {}
  ): Promise<string> {
    const jobId = crypto.randomUUID();

    // Create job in database
    const job = await PrintJob.create({
      jobId,
      outletId,
      receiptType,
      content: JSON.stringify(content),
      escposCommands: options.escposCommands ? JSON.stringify(options.escposCommands) : undefined,
      printerType: options.printerType,
      targetPrinter: options.targetPrinter,
      priority: options.priority || 'normal',
      status: 'pending',
      orderId: options.orderId,
      orderNumber: options.orderNumber
    });

    console.log(`🆕 Created print job ${jobId} for outlet ${outletId}`);

    // Try to send to connected agents immediately
    const outletAgentIds = this.outletAgents.get(outletId);
    if (outletAgentIds && outletAgentIds.size > 0) {
      // Send to first available agent (you can implement load balancing here)
      const agentId = Array.from(outletAgentIds)[0];
      await this.sendJobToAgent(agentId, job);
    } else {
      console.log(`📭 No agents online for outlet ${outletId}, job will be queued`);
    }

    return jobId;
  }

  // Get pending jobs for an outlet (for HTTP polling)
  async getPendingJobs(outletId: string, agentId: string): Promise<any[]> {
    const jobs = await PrintJob.find({
      outletId,
      status: 'pending'
    })
      .sort({ priority: -1, createdAt: 1 })
      .limit(10);

    // Mark jobs as sent
    const jobIds = jobs.map(j => j.jobId);
    if (jobIds.length > 0) {
      await PrintJob.updateMany(
        { jobId: { $in: jobIds } },
        {
          $set: {
            status: 'sent',
            agentId,
            sentAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    }

    // Format jobs correctly for agent
    const formattedJobs = jobs.map((job: any) => {
      // Parse content (stored as JSON string in database)
      let parsedContent: any = {};
      try {
        parsedContent = typeof job.content === 'string' ? JSON.parse(job.content) : job.content;
      } catch (error) {
        console.error(`❌ Error parsing job content for job ${job.jobId}:`, error);
        parsedContent = {};
      }

      // Parse escposCommands if present
      let parsedEscposCommands: any[] | undefined = undefined;
      if (job.escposCommands) {
        try {
          parsedEscposCommands = typeof job.escposCommands === 'string' 
            ? JSON.parse(job.escposCommands) 
            : job.escposCommands;
        } catch (error) {
          console.error(`❌ Error parsing escposCommands for job ${job.jobId}:`, error);
        }
      }

      // Build job payload - receiptType and content are REQUIRED
      const formattedJob: any = {
        jobId: job.jobId,
        receiptType: job.receiptType || 'KOT', // REQUIRED - default to KOT if missing
        content: parsedContent, // REQUIRED
      };

      // Add optional fields only if they exist
      if (job.printerType) {
        formattedJob.printerType = job.printerType;
      }
      if (job.targetPrinter) {
        formattedJob.targetPrinter = job.targetPrinter;
      }
      if (parsedEscposCommands) {
        formattedJob.escposCommands = parsedEscposCommands;
      }
      if (job.priority) {
        formattedJob.priority = job.priority;
      }
      if (job.createdAt) {
        formattedJob.createdAt = job.createdAt.getTime ? job.createdAt.getTime() : new Date(job.createdAt).getTime();
      }

      console.log(`📤 Formatting job ${job.jobId} for HTTP polling:`, {
        receiptType: formattedJob.receiptType,
        hasContent: !!formattedJob.content,
        contentType: typeof formattedJob.content,
        contentKeys: formattedJob.content ? Object.keys(formattedJob.content) : []
      });

      return formattedJob;
    });

    return formattedJobs;
  }

  // Generate pairing code
  async generatePairingCode(outletId: string, expiresInMinutes: number = 15): Promise<string> {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await PairingCode.create({
      code,
      outletId,
      expiresAt,
      used: false
    });

    console.log(`🔑 Generated pairing code ${code} for outlet ${outletId}`);

    return code;
  }

  // Exchange pairing code for API key
  async exchangePairingCode(
    code: string,
    agentId: string
  ): Promise<{ apiKey: string; outletId: string } | null> {
    console.log(`🔑 Pairing code exchange request:`, {
      code,
      agentId,
      agentIdLength: agentId?.length || 0,
      hasAgentPrefix: agentId?.startsWith('Agent') || false
    });

    // Find and validate pairing code
    const pairingCode = await PairingCode.findOne({ code });

    if (!pairingCode) {
      console.error(`❌ Pairing code ${code} not found`);
      return null;
    }

    if (pairingCode.used) {
      console.error(`❌ Pairing code ${code} already used by agent: ${pairingCode.usedBy}`);
      return null;
    }

    if (pairingCode.expiresAt < new Date()) {
      console.error(`❌ Pairing code ${code} expired at ${pairingCode.expiresAt}`);
      return null;
    }

    // Generate API key (32 bytes = 64 hex characters)
    const apiKey = crypto.randomBytes(32).toString('hex');

    console.log(`🔑 Generating API key for agent:`, {
      agentId,
      outletId: pairingCode.outletId,
      apiKeyLength: apiKey.length,
      apiKeyPreview: apiKey.substring(0, 16) + '...'
    });

    // Create or update agent
    const updateResult = await PrintAgent.updateOne(
      { agentId },
      {
        $set: {
          agentId,
          outletId: pairingCode.outletId,
          apiKey, // In production, encrypt this
          version: '1.0.0',
          platform: 'unknown',
          status: 'offline',
          capabilities: JSON.stringify({}),
          lastSeen: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`💾 Agent database operation:`, {
      agentId,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      upsertedCount: updateResult.upsertedCount
    });

    // Verify the agent was saved correctly
    const savedAgent = await PrintAgent.findOne({ agentId });
    if (!savedAgent) {
      console.error(`❌ CRITICAL: Agent ${agentId} not found after save!`);
      return null;
    }

    console.log(`✅ Agent verified in database:`, {
      agentId: savedAgent.agentId,
      outletId: savedAgent.outletId,
      hasApiKey: !!savedAgent.apiKey,
      apiKeyLength: savedAgent.apiKey?.length || 0,
      apiKeyMatches: savedAgent.apiKey === apiKey
    });

    // Mark pairing code as used
    await PairingCode.updateOne(
      { code },
      {
        $set: {
          used: true,
          usedBy: agentId
        }
      }
    );

    console.log(`✅ Pairing code ${code} exchanged for agent ${agentId}`);
    console.log(`🔑 Returning API key (${apiKey.length} chars) to agent`);

    return {
      apiKey,
      outletId: pairingCode.outletId
    };
  }

  // Validate API key
  async validateApiKey(agentId: string, apiKey: string): Promise<boolean> {
    console.log(`🔐 Validating API key for agent: ${agentId} (length: ${agentId.length})`);
    
    // Try to find agent by exact agentId
    let agent = await PrintAgent.findOne({ agentId });
    
    // If not found, try without "Agent" prefix (in case agent adds prefix)
    if (!agent && agentId.startsWith('Agent')) {
      const agentIdWithoutPrefix = agentId.substring(5); // Remove "Agent" prefix
      console.log(`🔍 Trying agentId without prefix: ${agentIdWithoutPrefix}`);
      agent = await PrintAgent.findOne({ agentId: agentIdWithoutPrefix });
      if (agent) {
        console.log(`✅ Found agent without prefix, updating agentId to match`);
        // Update agentId to match what agent is using
        await PrintAgent.updateOne({ _id: agent._id }, { $set: { agentId } });
      }
    }
    
    // If still not found, try with "Agent" prefix
    if (!agent && !agentId.startsWith('Agent')) {
      const agentIdWithPrefix = 'Agent' + agentId;
      console.log(`🔍 Trying agentId with prefix: ${agentIdWithPrefix}`);
      agent = await PrintAgent.findOne({ agentId: agentIdWithPrefix });
      if (agent) {
        console.log(`✅ Found agent with prefix, updating agentId to match`);
        // Update agentId to match what agent is using
        await PrintAgent.updateOne({ _id: agent._id }, { $set: { agentId } });
      }
    }
    
    if (!agent) {
      console.error(`❌ Agent ${agentId} not found in database`);
      // List all agents for debugging
      const allAgents = await PrintAgent.find({}).select('agentId outletId').limit(10);
      console.error(`📋 Available agents in database (${allAgents.length}):`, 
        allAgents.map(a => ({ 
          agentId: a.agentId.substring(0, 30) + '...', 
          outletId: a.outletId 
        }))
      );
      return false;
    }
    
    const isValid = agent.apiKey === apiKey;
    if (!isValid) {
      console.error(`❌ API key mismatch for agent ${agentId}`, {
        storedKeyLength: agent.apiKey?.length || 0,
        providedKeyLength: apiKey?.length || 0,
        storedKeyPreview: agent.apiKey ? agent.apiKey.substring(0, 16) + '...' : null,
        providedKeyPreview: apiKey ? apiKey.substring(0, 16) + '...' : null,
        keysMatch: agent.apiKey === apiKey,
        storedKeyEnd: agent.apiKey ? '...' + agent.apiKey.substring(agent.apiKey.length - 8) : null,
        providedKeyEnd: apiKey ? '...' + apiKey.substring(apiKey.length - 8) : null
      });
    } else {
      console.log(`✅ API key validated successfully for agent ${agentId}`);
    }
    return isValid; // In production, use proper encryption
  }

  // Get agent stats
  getStats() {
    return {
      connectedAgents: this.connectedAgents.size,
      totalOutlets: this.outletAgents.size,
      outletDistribution: Object.fromEntries(
        Array.from(this.outletAgents.entries()).map(([outletId, agents]) => [
          outletId,
          agents.size
        ])
      )
    };
  }

  // Get agents for outlet
  getAgentsForOutlet(outletId: string): AgentConnection[] {
    const agentIds = this.outletAgents.get(outletId);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(agentId => this.connectedAgents.get(agentId))
      .filter((conn): conn is AgentConnection => conn !== undefined);
  }
}

// Singleton instance
export const printAgentService = new PrintAgentService();

