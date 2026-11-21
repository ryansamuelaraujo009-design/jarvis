'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('jarvis', {
  toggle: () => ipcRenderer.invoke('voice:toggle'),
  status: () => ipcRenderer.invoke('voice:status'),
  ask: (text) => ipcRenderer.invoke('voice:ask', text),
  brainStatus: () => ipcRenderer.invoke('brain:status'),
  clearMemory: () => ipcRenderer.invoke('brain:clear'),
  train: () => ipcRenderer.invoke('brain:train'),
  menu: () => ipcRenderer.send('menu:show'),
  onState: (callback) => listen('state', callback)
});
