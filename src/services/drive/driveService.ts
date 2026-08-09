export interface DriveFileContent {
  schemaVersion: number;
  appVersion: string;
  updatedAt: number;
  user: any;
  wallets: any[];
  income: any[];
  expenses: any[];
  budgets: any[];
  subscriptions: any[];
  goals: any[];
  categories: any[];
  merchants: any[];
  bills: any[];
  settings: any[];
}

class DriveService {
  private accessToken: string | null = null;

  setToken(token: string) {
    this.accessToken = token;
  }

  hasToken(): boolean {
    return !!this.accessToken;
  }

  private getHeaders() {
    if (!this.accessToken) {
      throw new Error('No Google OAuth access token available. Please sign in.');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search for MoneyPilotData.json file in the user's Drive.
   * Returns the file ID if found, otherwise null.
   */
  async findDatabaseFile(): Promise<string | null> {
    const url = `https://www.googleapis.com/drive/v3/files?q=name='MoneyPilotData.json' and trashed=false&fields=files(id, name)`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to query Google Drive: ${err}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  /**
   * Download database file content by fileId.
   */
  async downloadFile(fileId: string): Promise<DriveFileContent> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to download database from Google Drive: ${err}`);
    }

    return await response.json();
  }

  /**
   * Create a new MoneyPilotData.json file in Google Drive.
   * Uses a multipart/related payload containing metadata and file contents.
   */
  async createDatabaseFile(content: DriveFileContent): Promise<string> {
    const metadata = {
      name: 'MoneyPilotData.json',
      mimeType: 'application/json',
    };

    const boundary = 'moneypilot_boundary_string';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(content) +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to create database on Google Drive: ${err}`);
    }

    const file = await response.json();
    return file.id;
  }

  /**
   * Overwrite existing MoneyPilotData.json in Google Drive using PATCH.
   */
  async updateDatabaseFile(fileId: string, content: DriveFileContent): Promise<void> {
    const metadata = {
      name: 'MoneyPilotData.json',
      mimeType: 'application/json',
    };

    const boundary = 'moneypilot_boundary_string';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(content) +
      closeDelimiter;

    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to sync database to Google Drive: ${err}`);
    }
  }

  /**
   * Permanently delete the database file from the user's Google Drive.
   */
  async deleteDatabaseFile(fileId: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok && response.status !== 404) {
      const err = await response.text();
      throw new Error(`Failed to delete database from Google Drive: ${err}`);
    }
  }
}

export const driveService = new DriveService();
