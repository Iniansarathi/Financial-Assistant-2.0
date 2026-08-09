/**
 * Feedback & Support Notification Service
 * Interfaces with the Google Apps Script spreadsheet backend.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;

// 1. Submit feedback / bug report with screenshot
export async function submitUserFeedback(
  email: string,
  message: string,
  screenshotBase64: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_ADMIN_API_URL is not configured.');
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'submitFeedback',
      email,
      message,
      screenshot: screenshotBase64,
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  return await response.json();
}

// 2. Fetch unread notifications for a specific user
export async function fetchUnreadNotifications(email: string): Promise<any[]> {
  if (!APPS_SCRIPT_URL) return [];

  const url = `${APPS_SCRIPT_URL}?action=checkNotifications&email=${encodeURIComponent(email)}`;
  const response = await fetch(url, { method: 'GET' });
  
  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.notifications || [];
}

// 3. Mark notification as read
export async function markNotificationAsRead(email: string, timestamp: string): Promise<boolean> {
  if (!APPS_SCRIPT_URL) return false;

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'markRead',
      email,
      timestamp
    })
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return !!data.success;
}

// 4. Fetch all raw feedback logs (for Admin Portal dashboard tab)
export async function fetchFeedbackList(): Promise<any[]> {
  if (!APPS_SCRIPT_URL) return [];

  const url = `${APPS_SCRIPT_URL}?action=fetchFeedback`;
  const response = await fetch(url, { method: 'GET' });
  
  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.feedback || [];
}

// 5. Send support reply notification (for Admin replying to user feedback)
export async function sendFeedbackReply(
  email: string,
  message: string,
  originalFeedback: string,
  originalScreenshot: string,
  originalTimestamp: string
): Promise<boolean> {
  if (!APPS_SCRIPT_URL) return false;

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sendNotification',
      email,
      message,
      originalFeedback,
      originalScreenshot,
      originalTimestamp
    })
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return !!data.success;
}
