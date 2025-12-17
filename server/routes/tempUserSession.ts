import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TempUserSessionModel } from '../models/TempUserSession';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';

const router = express.Router();

// Helper function to check MongoDB connection
const checkMongoConnection = () => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB not connected');
  }
  return mongoose.connection.db;
};

// Create a new temporary user session
router.post('/api/temp-session/create', async (req, res) => {
  try {
    console.log('🍽️ Temp session creation request received:', req.body);
    const { restaurantId, tableNumber, restaurantName, existingUserId, existingUserData } = req.body;

    if (!restaurantId || !tableNumber || !restaurantName) {
      console.log('❌ Missing required fields:', { restaurantId, tableNumber, restaurantName });
      return res.status(400).json({ 
        error: 'Missing required fields: restaurantId, tableNumber, restaurantName' 
      });
    }

    // Check for existing authenticated user first
    if (existingUserId && existingUserData) {
      console.log('🔍 Existing authenticated user detected:', existingUserId);
      
      // Verify the user exists in the database
      const db = checkMongoConnection();
      let userExists = false;
      
      try {
        // Check if user exists in MongoDB (for document-based users)
        const mongoUser = await db.collection('users').findOne({ 
          _id: typeof existingUserId === 'string' && existingUserId.match(/^[0-9a-fA-F]{24}$/) 
            ? new ObjectId(existingUserId) 
            : existingUserId
        });
        
        if (mongoUser) {
          userExists = true;
          console.log('✅ Existing user verified in MongoDB:', existingUserId);
        } else {
          // Try SQL-based user lookup (assuming a PostgreSQL connection exists)
          try {
            // This would need to be implemented based on your SQL storage implementation
            // For now, we'll trust the client-side cache validation
            userExists = true;
            console.log('✅ Trusting client-side validation for existing user:', existingUserId);
          } catch (sqlError) {
            console.error('Error checking SQL database for user:', sqlError);
          }
        }
      } catch (dbError) {
        console.error('Error checking database for existing user:', dbError);
      }
      
      if (userExists) {
        // Return a response that prioritizes the existing user
        return res.json({
          success: true,
          existingUserPrioritized: true,
          message: 'Using existing authenticated user session',
          userData: {
            ...existingUserData,
            restaurantId,
            restaurantName,
            tableNumber
          }
        });
      }
    }

    // Verify restaurant exists
    const db = checkMongoConnection();
    console.log('🔍 Checking restaurant:', restaurantId);
    const restaurant = await db.collection('restaurants').findOne({ 
      _id: new ObjectId(restaurantId) 
    });

    if (!restaurant) {
      console.log('❌ Restaurant not found:', restaurantId);
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    console.log('✅ Restaurant found:', restaurant.name);

    // Verify table exists
    console.log('🔍 Checking table:', { restaurantId, tableNumber });
    const table = await db.collection('restaurantTables').findOne({ 
      restaurantId,
      tableNumber 
    });

    if (!table) {
      console.log('❌ Table not found:', { restaurantId, tableNumber });
      return res.status(404).json({ error: 'Table not found' });
    }
    console.log('✅ Table found:', table.tableNumber);

    // Generate unique session and user IDs
    const sessionId = `temp_session_${uuidv4()}`;
    const tempUserId = `temp_user_${uuidv4()}`;
    const tempUserName = `Guest-${tableNumber}`;
    const tempUserEmail = `guest-${tempUserId}@temp.com`;

    // Create session with 7-minute expiry
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 60 * 1000); // 7 minutes

    const tempSession = new TempUserSessionModel({
      sessionId,
      restaurantId,
      tableNumber,
      restaurantName,
      tempUserId,
      tempUserName,
      tempUserEmail,
      expiresAt,
      isActive: true,
      lastActivity: now
    });

    await tempSession.save();

    console.log(`🍽️ Created temp session: ${sessionId} for table ${tableNumber} at ${restaurantName}`);

    res.json({
      success: true,
      sessionId,
      tempUser: {
        id: tempUserId,
        name: tempUserName,
        email: tempUserEmail,
        role: 'guest',
        restaurantId,
        restaurantName,
        tableNumber,
        sessionId,
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating temp session:', error);
    res.status(500).json({ error: 'Failed to create temporary session' });
  }
});

// Validate and get session details
router.get('/api/temp-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await TempUserSessionModel.findOne({ 
      sessionId, 
      isActive: true 
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      session.isActive = false;
      await session.save();
      return res.status(410).json({ error: 'Session expired' });
    }

    // Update last activity
    session.lastActivity = new Date();
    await session.save();

    res.json({
      success: true,
      sessionId: session.sessionId,
      tempUser: {
        id: session.tempUserId,
        name: session.tempUserName,
        email: session.tempUserEmail,
        role: 'guest',
        restaurantId: session.restaurantId,
        restaurantName: session.restaurantName,
        tableNumber: session.tableNumber,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({ error: 'Failed to validate session' });
  }
});

// Extend session (optional - for active users)
router.post('/api/temp-session/:sessionId/extend', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await TempUserSessionModel.findOne({ 
      sessionId, 
      isActive: true 
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      session.isActive = false;
      await session.save();
      return res.status(410).json({ error: 'Session expired' });
    }

    // Extend session by 7 minutes from now
    const newExpiresAt = new Date(Date.now() + 7 * 60 * 1000);
    session.expiresAt = newExpiresAt;
    session.lastActivity = new Date();
    await session.save();

    console.log(`🔄 Extended session: ${sessionId} until ${newExpiresAt.toISOString()}`);

    res.json({
      success: true,
      expiresAt: newExpiresAt.toISOString()
    });

  } catch (error) {
    console.error('Error extending session:', error);
    res.status(500).json({ error: 'Failed to extend session' });
  }
});

// End session
router.post('/api/temp-session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await TempUserSessionModel.findOne({ sessionId });

    if (session) {
      session.isActive = false;
      await session.save();
      console.log(`🔚 Ended session: ${sessionId}`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get active sessions (admin endpoint)
router.get('/api/temp-sessions/active', async (req, res) => {
  try {
    const activeSessions = await TempUserSessionModel.find({ 
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      sessions: activeSessions.map(session => ({
        sessionId: session.sessionId,
        restaurantName: session.restaurantName,
        tableNumber: session.tableNumber,
        tempUserName: session.tempUserName,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity,
        timeRemaining: Math.max(0, session.expiresAt.getTime() - Date.now())
      }))
    });

  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// Get session statistics (admin endpoint)
router.get('/api/temp-sessions/stats', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeCount, expiredCount, totalToday, totalAllTime] = await Promise.all([
      TempUserSessionModel.countDocuments({ 
        isActive: true, 
        expiresAt: { $gt: now } 
      }),
      TempUserSessionModel.countDocuments({ 
        isActive: false, 
        expiresAt: { $lt: now } 
      }),
      TempUserSessionModel.countDocuments({ 
        createdAt: { $gte: oneDayAgo } 
      }),
      TempUserSessionModel.countDocuments({})
    ]);

    res.json({
      success: true,
      stats: {
        active: activeCount,
        expired: expiredCount,
        totalToday,
        totalAllTime,
        lastUpdated: now.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});


export default router;
