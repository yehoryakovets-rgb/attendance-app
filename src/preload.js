const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData:    ()           => ipcRenderer.invoke('load-data'),
  saveData:    (data)       => ipcRenderer.invoke('save-data', data),
  exportXlsx:  (cls, choose) => ipcRenderer.invoke('export-xlsx', { cls, choose }),
});
