import React from 'react';

export default function SettingsPage() {
  return (
    <div>
      <h2>Settings</h2>
      <p>
        This page will manage outgoing webhook endpoints (e.g., Rewst) and related secrets.
        For now, it is a placeholder until the backend endpoints are implemented.
      </p>
      <ul>
        <li>Configure outgoing webhook URL(s)</li>
        <li>Optional HMAC shared secret for signing</li>
        <li>Enable/disable specific event types</li>
      </ul>
    </div>
  );
}
