import { LocalNotifications } from '@capacitor/local-notifications';

export const NotificationService = {
  async requestPermissions() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    } catch (e) {
      console.warn('LocalNotifications permission request failed:', e);
      return false;
    }
  },

  async schedule(title, body, extraData = {}) {
    try {
      // Prompt for permissions just-in-time if not already granted
      let status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        status = await LocalNotifications.requestPermissions();
      }
      
      if (status.display !== 'granted') {
         console.warn('Cannot schedule notification: Permission denied.');
         return;
      }

      console.log('Scheduling notification:', title, body);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title || 'Lifeguard AI Alert',
            body: body || 'Real-time health status update.',
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second delay
            sound: 'beep.wav',
            extra: extraData,
          }
        ]
      });
    } catch (e) {
      console.error('Failed to schedule local notification:', e);
    }
  }
};
