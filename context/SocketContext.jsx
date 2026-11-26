import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/env';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    if (!currentUser) {
      // Disconnect if user logs out
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection. SOCKET_URL comes from .env via config/env.js —
    // reading process.env directly here always yielded undefined, so the app
    // silently fell back to localhost, which on an Android emulator means the
    // emulator itself rather than the dev machine.
    // For production, deploy backend and update SOCKET_URL in .env
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      auth: {
        userId: currentUser.uid,
      },
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('reconnect_error', (err) => {
      console.error('Reconnection error:', err);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect');
      setError('Failed to reconnect to server');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [currentUser]);

  // Helper function to join a group room
  const joinGroup = useCallback(
    (groupId, userName) => {
      if (socket && currentUser) {
        socket.emit('join-group', {
          userId: currentUser.uid,
          groupId,
          userName: userName || currentUser.email,
        });
        console.log(`📍 Joining group: ${groupId}`);
      }
    },
    [socket, currentUser]
  );

  // Helper function to leave a group room
  const leaveGroup = useCallback(
    (groupId) => {
      if (socket && currentUser) {
        socket.emit('leave-group', {
          userId: currentUser.uid,
          groupId,
        });
        console.log(`👋 Leaving group: ${groupId}`);
      }
    },
    [socket, currentUser]
  );

  // Helper function to emit wake-up event
  const emitWakeUp = useCallback(
    (groupId, userName, wakeUpTime) => {
      if (socket && currentUser) {
        socket.emit('wake-up', {
          userId: currentUser.uid,
          groupId,
          userName: userName || currentUser.email,
          wakeUpTime,
        });
        console.log(`🌅 Emitting wake-up for group: ${groupId}`);
      }
    },
    [socket, currentUser]
  );

  // Helper function to subscribe to events
  const on = useCallback(
    (event, callback) => {
      if (socket) {
        socket.on(event, callback);
      }
    },
    [socket]
  );

  // Helper function to unsubscribe from events
  const off = useCallback(
    (event, callback) => {
      if (socket) {
        socket.off(event, callback);
      }
    },
    [socket]
  );

  /**
   * Buzz a member and wait for the server's verdict.
   *
   * The server owns both cooldowns now (5 minute grace, 3 minutes per target),
   * so it answers with `{ ok: true }` or `{ ok: false, reason, remainingMs }`.
   * That answer is what lets the UI show the real reason instead of a false
   * "buzz sent".
   *
   * Two rollout details matter:
   *  - `targetWakeTime` (the target's scheduled wake time, ms) is what the grace
   *    check uses; the server clamps it, so a bad value degrades to "skip grace".
   *  - if the ack never arrives (an older server that does not send one), the
   *    buzz WAS delivered, so a timeout resolves as success rather than telling
   *    the user their buzz failed.
   *
   * @returns {Promise<{ok: boolean, reason?: string, remainingMs?: number, wakeTimeMs?: number}>}
   */
  const buzzUser = useCallback(
    (toUserId, groupId, fromUserName, groupName, targetWakeTime) =>
      new Promise((resolve) => {
        if (!socket || !currentUser) {
          resolve({ ok: false, reason: 'offline' });
          return;
        }

        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        const timer = setTimeout(() => {
          // No ack: assume the older server delivered it silently.
          console.log('🔔 Buzz ack timed out; assuming delivery');
          finish({ ok: true, unconfirmed: true });
        }, 6000);

        try {
          socket.emit(
            'buzz-user',
            {
              fromUserId: currentUser.uid,
              fromUserName: fromUserName || currentUser.email,
              toUserId,
              groupId,
              groupName, // Include group name for the buzzed user
              targetWakeTime: Number(targetWakeTime) || undefined,
            },
            (response) => {
              clearTimeout(timer);
              finish(response && typeof response === 'object' ? response : { ok: true });
            }
          );
          console.log(`🔔 Buzzing user: ${toUserId} from group: ${groupName}`);
        } catch (err) {
          clearTimeout(timer);
          console.warn('Buzz emit failed:', err?.message || err);
          finish({ ok: false, reason: 'error' });
        }
      }),
    [socket, currentUser]
  );

  const value = {
    socket,
    isConnected,
    error,
    joinGroup,
    leaveGroup,
    emitWakeUp,
    buzzUser,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
