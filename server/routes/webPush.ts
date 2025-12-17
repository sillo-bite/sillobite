import express from 'express';
import { webPushService } from '../services/webPushService.js';

const router = express.Router();

/**
 * Get VAPID public key for client-side subscription
 */
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = webPushService.getVAPIDPublicKey();
    
    if (!publicKey) {
      return res.status(503).json({ 
        error: 'Push notifications not configured',
        message: 'VAPID keys not available'
      });
    }

    res.json({ 
      publicKey,
      configured: webPushService.isConfigured()
    });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: 'Failed to get VAPID public key' });
  }
});

/**
 * Subscribe to push notifications
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId, userRole, deviceInfo } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ 
        error: 'Invalid subscription object',
        message: 'Missing endpoint or keys'
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing userId',
        message: 'User ID is required for subscription'
      });
    }

    const subscriptionId = webPushService.addSubscription(
      subscription,
      userId.toString(),
      userRole || 'student',
      deviceInfo
    );

    console.log(`📱 User ${userId} subscribed to push notifications`);

    res.json({ 
      success: true, 
      subscriptionId,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
});

/**
 * Unsubscribe from push notifications
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ 
        error: 'Missing subscriptionId',
        message: 'Subscription ID is required'
      });
    }

    const removed = webPushService.removeSubscription(subscriptionId);

    if (!removed) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        message: 'The subscription ID was not found'
      });
    }

    res.json({ 
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
  }
});

/**
 * Send test notification
 */
router.post('/send-test', async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing userId',
        message: 'User ID is required to send test notification'
      });
    }

    await webPushService.sendToUser(userId.toString(), {
      title: title || '🔔 Android Test Notification',
      body: message || 'This notification should appear as a banner on Android devices!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        type: 'test',
        timestamp: Date.now(),
      },
      tag: 'test_notification',
      // Android-specific settings for heads-up notifications
      priority: 'high',
      urgency: 'high',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
    });

    res.json({ 
      success: true,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * Send notification to specific user
 */
router.post('/send-to-user', async (req, res) => {
  try {
    const { userId, title, body, data, url } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'userId, title, and body are required'
      });
    }

    await webPushService.sendToUser(userId.toString(), {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data || {},
      url,
    });

    res.json({ 
      success: true,
      message: 'Notification sent to user successfully'
    });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({ error: 'Failed to send notification to user' });
  }
});

/**
 * Send notification to users with specific role
 */
router.post('/send-to-role', async (req, res) => {
  try {
    const { role, title, body, data, url } = req.body;

    if (!role || !title || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'role, title, and body are required'
      });
    }

    await webPushService.sendToRole(role, {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data || {},
      url,
    });

    res.json({ 
      success: true,
      message: `Notification sent to users with role: ${role}`
    });
  } catch (error) {
    console.error('Error sending notification to role:', error);
    res.status(500).json({ error: 'Failed to send notification to role' });
  }
});

/**
 * Send broadcast notification to all users
 */
router.post('/send-to-all', async (req, res) => {
  try {
    const { title, body, data, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'title and body are required'
      });
    }

    await webPushService.sendToAll({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data || {},
      url,
    });

    res.json({ 
      success: true,
      message: 'Broadcast notification sent to all users'
    });
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    res.status(500).json({ error: 'Failed to send broadcast notification' });
  }
});

/**
 * Get push notification statistics
 */
/**
 * Send test order status notification
 */
router.post('/test-order-status', async (req, res) => {
  try {
    const { userId, orderNumber, status } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing userId',
        message: 'User ID is required to send test order notification'
      });
    }

    const testOrderNumber = orderNumber || Math.random().toString().slice(2, 12);
    const testStatus = status || 'ready';

    await webPushService.sendOrderUpdate(
      userId.toString(),
      testOrderNumber,
      testStatus,
      `Test notification: Your order #${testOrderNumber} is ${testStatus}!`
    );

    res.json({ 
      success: true,
      message: 'Test order status notification sent successfully',
      orderNumber: testOrderNumber,
      status: testStatus
    });
  } catch (error) {
    console.error('Error sending test order status notification:', error);
    res.status(500).json({ error: 'Failed to send test order status notification' });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = webPushService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting push notification stats:', error);
    res.status(500).json({ error: 'Failed to get push notification stats' });
  }
});

/**
 * Get all notification templates
 */
router.get('/templates', (req, res) => {
  try {
    const templates = webPushService.getNotificationTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting notification templates:', error);
    res.status(500).json({ error: 'Failed to get notification templates' });
  }
});

/**
 * Get specific notification template
 */
router.get('/templates/:status', (req, res) => {
  try {
    const { status } = req.params;
    const template = webPushService.getNotificationTemplate(status);
    
    if (!template) {
      return res.status(404).json({ 
        error: 'Template not found',
        message: `No template found for status: ${status}`
      });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error getting notification template:', error);
    res.status(500).json({ error: 'Failed to get notification template' });
  }
});

/**
 * Update notification template
 */
router.put('/templates/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const template = req.body;
    
    if (!template || template.status !== status) {
      return res.status(400).json({ 
        error: 'Invalid template data',
        message: 'Template status must match URL parameter'
      });
    }
    
    const updated = await webPushService.updateNotificationTemplate(template);
    
    if (!updated) {
      return res.status(404).json({ 
        error: 'Template not found',
        message: `No template found for status: ${status}`
      });
    }
    
    res.json({ 
      success: true,
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating notification template:', error);
    res.status(500).json({ error: 'Failed to update notification template' });
  }
});

/**
 * Create new notification template
 */
router.post('/templates', async (req, res) => {
  try {
    const template = req.body;
    
    if (!template || !template.status || !template.title || !template.message) {
      return res.status(400).json({ 
        error: 'Invalid template data',
        message: 'status, title, and message are required'
      });
    }
    
    const created = await webPushService.addNotificationTemplate(template);
    
    if (!created) {
      return res.status(409).json({ 
        error: 'Template already exists',
        message: `Template for status ${template.status} already exists`
      });
    }
    
    res.status(201).json({ 
      success: true,
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error creating notification template:', error);
    res.status(500).json({ error: 'Failed to create notification template' });
  }
});

/**
 * Delete notification template
 */
router.delete('/templates/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const deleted = await webPushService.deleteNotificationTemplate(status);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Template not found',
        message: `No template found for status: ${status}`
      });
    }
    
    res.json({ 
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification template:', error);
    res.status(500).json({ error: 'Failed to delete notification template' });
  }
});

/**
 * Custom notification template routes
 */

/**
 * Get all custom notification templates
 */
router.get('/custom-templates', async (req, res) => {
  try {
    const templates = await webPushService.getCustomTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting custom templates:', error);
    res.status(500).json({ error: 'Failed to get custom templates' });
  }
});

/**
 * Get specific custom notification template
 */
router.get('/custom-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await webPushService.getCustomTemplate(id);
    
    if (!template) {
      return res.status(404).json({ 
        error: 'Template not found',
        message: `No custom template found with id: ${id}`
      });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error getting custom template:', error);
    res.status(500).json({ error: 'Failed to get custom template' });
  }
});

/**
 * Create new custom notification template
 */
router.post('/custom-templates', async (req, res) => {
  try {
    const { name, title, message, icon, priority, requireInteraction, createdBy } = req.body;
    
    if (!name || !title || !message || !createdBy) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'name, title, message, and createdBy are required'
      });
    }
    
    const result = await webPushService.createCustomTemplate({
      name,
      title,
      message,
      icon: icon || '🔔',
      priority: priority || 'normal',
      requireInteraction: requireInteraction || false,
      enabled: true,
      createdBy: parseInt(createdBy)
    });
    
    if (!result.success) {
      return res.status(500).json({ 
        error: 'Failed to create template',
        message: 'Could not create custom notification template'
      });
    }
    
    res.status(201).json({ 
      success: true,
      message: 'Custom template created successfully',
      template: result.template
    });
  } catch (error) {
    console.error('Error creating custom template:', error);
    res.status(500).json({ error: 'Failed to create custom template' });
  }
});

/**
 * Update custom notification template
 */
router.put('/custom-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = await webPushService.updateCustomTemplate(id, updates);
    
    if (!updated) {
      return res.status(404).json({ 
        error: 'Template not found',
        message: `No custom template found with id: ${id}`
      });
    }
    
    res.json({ 
      success: true,
      message: 'Custom template updated successfully'
    });
  } catch (error) {
    console.error('Error updating custom template:', error);
    res.status(500).json({ error: 'Failed to update custom template' });
  }
});

/**
 * Delete custom notification template
 */
router.delete('/custom-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await webPushService.deleteCustomTemplate(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Template not found',
        message: `No custom template found with id: ${id}`
      });
    }
    
    res.json({ 
      success: true,
      message: 'Custom template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom template:', error);
    res.status(500).json({ error: 'Failed to delete custom template' });
  }
});

/**
 * Send notification with advanced targeting
 */
router.post('/send-advanced', async (req, res) => {
  try {
    const { targetType, values, title, body, data, url } = req.body;
    
    if (!targetType || !title || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'targetType, title, and body are required'
      });
    }

    const criteria = { targetType, values };
    const payload = {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data || {},
      url,
    };

    const result = await webPushService.sendWithAdvancedTargeting(criteria, payload);
    
    res.json({ 
      success: result.success,
      message: `Notification sent successfully`,
      sentCount: result.sentCount,
      targetCount: result.targetCount
    });
  } catch (error) {
    console.error('Error sending advanced notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * Send custom template notification with advanced targeting
 */
router.post('/send-custom-template', async (req, res) => {
  try {
    const { templateId, targetType, values, customData } = req.body;
    
    if (!templateId || !targetType) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'templateId and targetType are required'
      });
    }

    const criteria = { targetType, values };
    const result = await webPushService.sendCustomTemplateNotification(
      templateId, 
      criteria, 
      customData
    );
    
    res.json({ 
      success: result.success,
      message: `Custom template notification sent successfully`,
      sentCount: result.sentCount,
      targetCount: result.targetCount
    });
  } catch (error) {
    console.error('Error sending custom template notification:', error);
    res.status(500).json({ error: 'Failed to send custom template notification' });
  }
});

export default router;