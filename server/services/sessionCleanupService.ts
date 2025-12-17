import { TempUserSessionModel } from '../models/TempUserSession';

/**
 * Session cleanup service for temporary user sessions
 * Runs every minute to clean up expired sessions
 */
export class SessionCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the session cleanup service
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 Session cleanup service is already running');
      return;
    }

    console.log('🚀 Starting session cleanup service...');
    this.isRunning = true;

    // Run cleanup every minute
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 60 * 1000); // 60 seconds

    // Run initial cleanup
    this.cleanupExpiredSessions();
  }

  /**
   * Stop the session cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Session cleanup service stopped');
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      
      // Find and deactivate expired sessions
      const result = await TempUserSessionModel.updateMany(
        {
          isActive: true,
          expiresAt: { $lt: now }
        },
        {
          $set: { isActive: false }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Cleaned up ${result.modifiedCount} expired temporary user sessions`);
      }

      // Also clean up very old inactive sessions (older than 1 hour)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const deleteResult = await TempUserSessionModel.deleteMany({
        isActive: false,
        expiresAt: { $lt: oneHourAgo }
      });

      if (deleteResult.deletedCount > 0) {
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} old inactive sessions`);
      }

    } catch (error) {
      console.error('❌ Error during session cleanup:', error);
    }
  }

  /**
   * Get cleanup service status
   */
  getStatus(): { isRunning: boolean; nextCleanup?: Date } {
    return {
      isRunning: this.isRunning,
      nextCleanup: this.isRunning ? new Date(Date.now() + 60 * 1000) : undefined
    };
  }

  /**
   * Force cleanup of expired sessions
   */
  async forceCleanup(): Promise<{ expired: number; deleted: number }> {
    console.log('🔄 Force cleanup initiated...');
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Deactivate expired sessions
    const expiredResult = await TempUserSessionModel.updateMany(
      {
        isActive: true,
        expiresAt: { $lt: now }
      },
      {
        $set: { isActive: false }
      }
    );

    // Delete old inactive sessions
    const deletedResult = await TempUserSessionModel.deleteMany({
      isActive: false,
      expiresAt: { $lt: oneHourAgo }
    });

    console.log(`🧹 Force cleanup completed: ${expiredResult.modifiedCount} expired, ${deletedResult.deletedCount} deleted`);

    return {
      expired: expiredResult.modifiedCount,
      deleted: deletedResult.deletedCount
    };
  }
}

// Create singleton instance
export const sessionCleanupService = new SessionCleanupService();

