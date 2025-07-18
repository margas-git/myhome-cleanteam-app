import { db } from "../db/connection.js";
import { serverEvents, jobs, timeEntries } from "../db/schema.js";
import { eq, and, isNull, lte } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';
import { sql } from "drizzle-orm";

// Generate unique server ID for this instance
const SERVER_ID = uuidv4();

// Store local SSE connections
const localSSEConnections = new Map<number, any>();

// Lightweight approach: Use polling with smart caching
const POLLING_INTERVAL = 5000; // 5 seconds (better than 10, not as aggressive as 3)
const CACHE_DURATION = 30000; // 30 seconds cache

// Cache for job updates to avoid unnecessary polling
const jobUpdateCache = new Map<string, number>(); // jobId -> lastUpdateTime

// Register a local SSE connection
export function registerSSEConnection(userId: number, response: any) {
  localSSEConnections.set(userId, response);
}

// Remove a local SSE connection
export function unregisterSSEConnection(userId: number) {
  localSSEConnections.delete(userId);
}

// Send event to all local SSE connections
export function broadcastToLocalConnections(event: any) {
  if (localSSEConnections.size === 0) return;
  
  console.log('📡 Broadcasting to local connections:', event.type, 'to', localSSEConnections.size, 'connections');
  localSSEConnections.forEach((connection, userId) => {
    if (!connection.destroyed) {
      connection.write(`data: ${JSON.stringify(event)}\n\n`);
      console.log('📤 Sent to local user:', userId);
    } else {
      console.log('❌ Local connection destroyed for user:', userId);
      localSSEConnections.delete(userId);
    }
  });
}

// Lightweight: Broadcast only to local connections (no cross-server complexity)
export async function broadcastCrossServerEvent(event: any) {
  try {
    console.log('💾 Broadcasting local event:', event.type);
    
    // Only broadcast to local connections (much simpler)
    broadcastToLocalConnections(event);
    
    // For cross-server, we'll use a different approach...
  } catch (error) {
    console.error('❌ Failed to broadcast event:', error);
  }
}

// Check for job updates from other servers (lightweight polling)
export async function checkForJobUpdates() {
  try {
    // Only check if we have active connections
    if (localSSEConnections.size === 0) return;
    
    // Get recent time entry updates (last 10 seconds) - this indicates job changes
    const tenSecondsAgo = new Date(Date.now() - 10000);
    
    const recentTimeEntryUpdates = await db
      .select({
        jobId: timeEntries.jobId,
        updatedAt: sql<Date>`GREATEST(${timeEntries.clockInTime}, ${timeEntries.clockOutTime})`
      })
      .from(timeEntries)
      .where(
        and(
          sql`GREATEST(${timeEntries.clockInTime}, ${timeEntries.clockOutTime}) > ${tenSecondsAgo}`,
          sql`${timeEntries.jobId} IS NOT NULL`
        )
      )
      .groupBy(timeEntries.jobId);

    for (const entry of recentTimeEntryUpdates) {
      const cacheKey = `job_${entry.jobId}`;
      const lastUpdate = jobUpdateCache.get(cacheKey);
      
      // Only broadcast if this is a new update
      if (!lastUpdate || entry.updatedAt.getTime() > lastUpdate) {
        jobUpdateCache.set(cacheKey, entry.updatedAt.getTime());
        
        broadcastToLocalConnections({
          type: 'job_updated',
          jobId: entry.jobId,
          timestamp: entry.updatedAt
        });
        
        console.log('🔄 Detected job update via time entry:', entry.jobId);
      }
    }
  } catch (error) {
    console.error('❌ Failed to check for job updates:', error);
  }
}

// Clean up old cache entries
export function cleanupJobCache() {
  const now = Date.now();
  const cacheExpiry = now - CACHE_DURATION;
  
  for (const [key, timestamp] of jobUpdateCache.entries()) {
    if (timestamp < cacheExpiry) {
      jobUpdateCache.delete(key);
    }
  }
  
  console.log('🧹 Cleaned up job cache');
}

// Start the lightweight event processor
export function startCrossServerEventProcessor() {
  // Check for job updates every 5 seconds (lightweight)
  setInterval(checkForJobUpdates, POLLING_INTERVAL);
  
  // Cleanup cache every 5 minutes
  setInterval(cleanupJobCache, 5 * 60 * 1000);
  
  console.log('🚀 Started lightweight event processor with server ID:', SERVER_ID);
  console.log('⚡ Performance settings:');
  console.log('   - Polling interval:', POLLING_INTERVAL, 'ms');
  console.log('   - Cache duration:', CACHE_DURATION, 'ms');
  console.log('   - No database writes for events');
  console.log('   - Lightweight polling only');
} 