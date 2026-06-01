const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData:    ()           => ipcRenderer.invoke('load-data'),
  saveData:    (data)       => ipcRenderer.invoke('save-data', data),
  exportXlsx:  (cls, choose) => ipcRenderer.invoke('export-xlsx', { cls, choose }),
  saveAm:      (cls)        => ipcRenderer.invoke('save-am', { cls }),
  openAm:      ()           => ipcRenderer.invoke('open-am'),
  writeAm:     (path, cls)  => ipcRenderer.invoke('write-am', { path, cls }),
  onOpenAm:    (cb)         => ipcRenderer.on('open-am-file', (_e, data) => cb(data)),
});
